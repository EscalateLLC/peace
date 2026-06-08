import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  EndBehaviorType,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection
} from '@discordjs/voice';
import prism from 'prism-media';
import type { VoiceBasedChannel } from 'discord.js';
import { speakerId } from '@peace/core';
import {
  discordTextEvent,
  type AudioFormat,
  type DiscordTextInput,
  type PlatformAdapter,
  type PlatformHandlers,
  type SpeakerRef,
  type SpeechHandle
} from '@peace/adapters';
import { errorFields, type Logger } from '@peace/logger';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

/** A speaker pause this long closes the utterance stream (Discord-side capture detail). */
const SILENCE_MS = 800;

const DISCORD_AUDIO_FORMAT: AudioFormat = {
  sampleRate: SAMPLE_RATE,
  channels  : CHANNELS,
  encoding  : 'pcm-s16le'
};

/**
 * s16le mono → interleaved stereo: duplicate each 16-bit sample into L and R.
 * Discord's player expects 48kHz stereo; Aura streams mono. Pure + allocating.
 */
export function upmixMonoToStereo (mono: Buffer): Buffer {
  const sampleCount = Math.floor(mono.length / 2); // 2 bytes per sample
  const stereo = Buffer.allocUnsafe(sampleCount * 4);

  for (let i = 0; i < sampleCount; i++) {
    const sample = mono.readInt16LE(i * 2);

    stereo.writeInt16LE(sample, i * 4);
    stereo.writeInt16LE(sample, i * 4 + 2);
  }

  return stereo;
}

/** Up-mix a mono PCM frame stream to stereo, carrying any odd trailing byte across frames. */
async function* upmixStream (frames: AsyncIterable<Buffer>): AsyncIterable<Buffer> {
  let carry: Buffer | null = null;

  for await (const frame of frames) {
    let buffer: Buffer = carry ? Buffer.concat([carry, frame]) : frame;

    carry = null;

    if (buffer.length % 2 !== 0) {
      carry = buffer.subarray(buffer.length - 1);
      buffer = buffer.subarray(0, buffer.length - 1);
    }

    if (buffer.length > 0) {
      yield upmixMonoToStereo(buffer);
    }
  }
}

/**
 * Streaming linear-interpolation resampler over s16le mono samples. Stateful
 * across calls (carries the last source sample + fractional position), so it
 * works chunk-by-chunk on a stream. For the common 24kHz→48kHz (ElevenLabs→
 * Discord) case this is a clean 2× upsample; arbitrary ratios also work.
 */
export function createLinearResampler (srcRate: number, dstRate: number): (input: Int16Array) => Int16Array {
  const step = srcRate / dstRate; // source samples consumed per output sample
  let prev: number | null = null;
  let pos = 0; // fractional position in [prev, cur), 0..1

  return (input: Int16Array): Int16Array => {
    const out: number[] = [];

    for (const cur of input) {
      if (prev === null) {
        prev = cur;
        continue;
      }

      while (pos < 1) {
        out.push(Math.round(prev * (1 - pos) + cur * pos));
        pos += step;
      }

      pos -= 1;
      prev = cur;
    }

    return Int16Array.from(out);
  };
}

/** Resample a mono s16le frame stream from srcRate to dstRate (linear), carrying odd bytes. */
async function* resampleMonoStream (frames: AsyncIterable<Buffer>, srcRate: number, dstRate: number): AsyncIterable<Buffer> {
  const resample = createLinearResampler(srcRate, dstRate);
  let carry: Buffer | null = null;

  for await (const frame of frames) {
    let buffer: Buffer = carry ? Buffer.concat([carry, frame]) : frame;

    carry = null;

    if (buffer.length % 2 !== 0) {
      carry = buffer.subarray(buffer.length - 1);
      buffer = buffer.subarray(0, buffer.length - 1);
    }

    const sampleCount = buffer.length / 2;

    if (sampleCount === 0) {
      continue;
    }

    const samples = new Int16Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      samples[i] = buffer.readInt16LE(i * 2);
    }

    const resampled = resample(samples);

    if (resampled.length > 0) {
      const out = Buffer.allocUnsafe(resampled.length * 2);

      for (let i = 0; i < resampled.length; i++) {
        out.writeInt16LE(resampled[i] as number, i * 2);
      }

      yield out;
    }
  }
}

/** Convert a provider's PCM stream to Discord's 48kHz stereo: resample then up-mix as needed. */
function toDiscordStereo (pcm: AsyncIterable<Buffer>, format: AudioFormat): AsyncIterable<Buffer> {
  if (format.channels === 2 && format.sampleRate === SAMPLE_RATE) {
    return pcm;
  }

  const at48k = format.sampleRate === SAMPLE_RATE ? pcm : resampleMonoStream(pcm, format.sampleRate, SAMPLE_RATE);

  return format.channels === 1 ? upmixStream(at48k) : at48k;
}

/** Playback gain (0..2), env-tunable via PEACE_TTS_VOLUME; ElevenLabs/Aura run hot, so default conservatively. */
const TTS_VOLUME = (() => {
  const parsed = Number(process.env.PEACE_TTS_VOLUME);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 2) : 0.5;
})();

export interface DiscordAdapterOptions {
  log: Logger;

  /** Resolve a user id to a display name for speaker labels. */
  resolveLabel: (userId: string) => string;

  /** Send a message to the meeting's text channel (egress.sendText / liveness fallback). */
  sendChat?: (text: string) => Promise<void>;

  /** Voice connection lost and could not self-recover — the host decides rejoin vs exit. */
  onVoiceDropped?: () => void;

  /** Bot speech finished playing (router registration trigger). Carries the speak() handle. */
  onSpeechFinished?: (handle: SpeechHandle) => void;

  /** Bot speech was aborted mid-play (barge-in). Carries the speak() handle. */
  onSpeechAborted?: (handle: SpeechHandle, reason: string) => void;
}

/**
 * Discord's implementation of the platform-adapter contract. Lives next to
 * its SDK (not in packages/adapters) so @discordjs/* stays out of shared
 * packages. The bot's gateway router drives the Discord-specific entry
 * points (ingestMessage, joinVoice); everything flows out through the
 * platform handlers — this adapter never touches STT or the database.
 */
export interface DiscordPlatformAdapter extends PlatformAdapter {

  /** Normalize a routed chat message and push it through onText. */
  ingestMessage: (input: DiscordTextInput) => void;

  /** Attach voice capture to the session (Discord meetings can add voice mid-meeting). */
  joinVoice: (channel: VoiceBasedChannel) => Promise<void>;

  /** True while a live voice connection exists (gates voice announcements vs chat fallback). */
  inVoice: () => boolean;
}

export function createDiscordAdapter (options: DiscordAdapterOptions): DiscordPlatformAdapter {
  const { log } = options;
  let handlers: PlatformHandlers | null = null;
  let connection: VoiceConnection | null = null;
  let player: AudioPlayer | null = null;
  let speechSeq = 0;
  let currentSpeech: SpeechHandle | null = null;

  // One player per adapter, subscribed once per connection. noSubscriber:Play
  // keeps it draining if the subscription momentarily drops.
  function ensurePlayer (conn: VoiceConnection): AudioPlayer {
    if (!player) {
      player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
      player.on('error', error => log.warn('voice.player_error', errorFields(error)));
      player.on(AudioPlayerStatus.Idle, () => {
        if (currentSpeech) {
          const finished = currentSpeech;

          currentSpeech = null;
          log.info('voice.speak_finished', { handle: finished.id });
          options.onSpeechFinished?.(finished);
        }
      });
    }

    conn.subscribe(player);

    return player;
  }

  return {
    platform    : 'discord',
    capabilities: {
      canSpeak          : true,
      hasPerSpeakerAudio: true,
      supportsBargeIn   : true,
      canSendText       : true,
      hasTextIngress    : true,
      audioFormat       : DISCORD_AUDIO_FORMAT
    },
    egress: {
      sendText: text => (options.sendChat ? options.sendChat(text) : Promise.reject(new Error('discord adapter has no text channel wired'))),

      speak: (pcm, format) => {
        if (!connection) {
          return Promise.reject(new Error('not connected to a voice channel'));
        }

        const active = ensurePlayer(connection);
        const resource = createAudioResource(Readable.from(toDiscordStereo(pcm, format)), {
          inputType   : StreamType.Raw,
          inlineVolume: true
        });

        resource.volume?.setVolume(TTS_VOLUME);

        const handle: SpeechHandle = { id: `speech-${++speechSeq}` };

        currentSpeech = handle;
        active.play(resource);
        log.info('voice.speak_started', { handle: handle.id });

        return Promise.resolve(handle);
      },

      abortSpeech: (handle, reason) => {
        if (currentSpeech?.id !== handle.id) {
          return;
        }

        // Clear BEFORE stop() so the resulting Idle doesn't also fire finished.
        currentSpeech = null;
        log.info('voice.speak_aborted', {
          handle: handle.id,
          reason
        });
        options.onSpeechAborted?.(handle, reason);

        // stop(true) destroys the resource stream, which returns the PCM
        // generator and cancels the upstream TTS body — barge-in in one call.
        player?.stop(true);
      }
    },

    inVoice: () => connection !== null,

    connect: connectHandlers => {
      handlers = connectHandlers;

      return Promise.resolve();
    },

    disconnect: () => {
      try {
        player?.stop(true);
        connection?.destroy();
      } catch {
        // already destroyed (e.g. by the Disconnected teardown)
      }

      connection = null;

      return Promise.resolve();
    },

    ingestMessage: input => {
      handlers?.onText(discordTextEvent(input));
    },

    joinVoice: async channel => {
      if (!handlers) {
        throw new Error('connect() must be called before joinVoice()');
      }

      const active = handlers;

      connection = joinVoiceChannel({
        channelId     : channel.id,
        guildId       : channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf      : false,

        // Must be false to transmit (the bot speaks now). Honest mute-flicker
        // etiquette (voice/02) is deferred polish — tracked there.
        selfMute: false
      });

      // Attach observers BEFORE awaiting Ready — handshake failures live there.
      connection.on('stateChange', (oldState, newState) => {
        log.debug('voice.connection_state', {
          from: oldState.status,
          to  : newState.status
        });
      });
      connection.on('error', error => {
        log.error('voice.connection_error', errorFields(error));
        active.onError(error);
      });

      // Mid-call drops (region move, kick, network blip): give Discord 5s to
      // start re-establishing; otherwise tear down cleanly instead of leaving
      // a half-dead connection haunting the call.
      const conn = connection;

      conn.on(VoiceConnectionStatus.Disconnected, () => {
        Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5000)
        ]).then(() => {
          log.info('voice.reconnecting', { voiceChannelId: channel.id });
        })
          .catch(() => {
            log.warn('voice.disconnected_permanently', { voiceChannelId: channel.id });

            try {
              conn.destroy();
            } catch {
              // already destroyed by a concurrent disconnect()
            }

            if (connection === conn) {
              connection = null;
            }

            // The host (index.ts) decides rejoin-vs-exit based on who's still
            // in the channel — the adapter just reports the drop.
            options.onVoiceDropped?.();
          });
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      } catch (error) {
        connection.destroy();
        connection = null;
        log.error('voice.connect_timeout', {
          voiceChannelId: channel.id,
          ...errorFields(error)
        });
        throw new Error('voice connection did not become ready within 15s — check the bot\'s Connect permission, the firewall (UDP), and that an encryption library is installed (see voice.dependency_report in the logs)');
      }

      log.info('voice.connected', {
        voiceChannelId: channel.id,
        guildId       : channel.guild.id
      });

      const receiver = connection.receiver;
      const subscribed = new Set<string>();

      receiver.speaking.on('start', (userId: string) => {
        if (subscribed.has(userId)) {
          return;
        }

        subscribed.add(userId);
        log.debug('voice.speaking_start', { userId });

        const speaker: SpeakerRef = {
          speakerId   : speakerId('discord', userId),
          speakerLabel: options.resolveLabel(userId)
        };

        active.onSpeaking(speaker, 'start');

        const opusStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: SILENCE_MS
          }
        });
        const decoder = new prism.opus.Decoder({
          rate     : SAMPLE_RATE,
          channels : CHANNELS,
          frameSize: 960
        });

        opusStream.pipe(decoder);

        // Bridge the decoder into the contract's frame iterable. An Opus
        // stream error ends the utterance with whatever was captured — same
        // semantics as MVP1's finish-on-error.
        const frames: Buffer[] = [];
        let done = false;
        let notify: (() => void) | null = null;

        const finish = () => {
          if (done) {
            return;
          }

          done = true;
          subscribed.delete(userId);
          active.onSpeaking(speaker, 'stop');
          notify?.();
        };

        decoder.on('data', (chunk: Buffer) => {
          frames.push(chunk);
          notify?.();
        });
        decoder.once('end', finish);
        opusStream.once('error', (error: Error) => {
          log.warn('voice.opus_stream_error', {
            userId,
            ...errorFields(error)
          });
          active.onError(error);
          finish();
        });

        active.onVoice({
          kind     : 'per-speaker',
          speaker,
          format   : DISCORD_AUDIO_FORMAT,
          startedAt: Date.now(),

          audio: (async function* pcmFrames () {
            for (;;) {
              while (frames.length > 0) {
                yield frames.shift() as Buffer;
              }

              if (done) {
                return;
              }

              await new Promise<void>(resolve => {
                notify = resolve;
              });
              notify = null;
            }
          }())
        });
      });
    }
  };
}
