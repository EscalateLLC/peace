import { randomUUID } from 'node:crypto';
import {
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection
} from '@discordjs/voice';
import prism from 'prism-media';
import type { VoiceBasedChannel } from 'discord.js';
import { conversationEventSchema } from '@peace/core';
import { insertSegments, type PeaceDb } from '@peace/db';
import { errorFields, type Logger } from '@peace/logger';
import type { SpeechToText } from '@peace/transcription';
import type { ActiveMeeting } from './state';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * 2;

/** Utterances shorter than this are dropped (coughs, key clicks). */
const MIN_UTTERANCE_MS = 350;

/** A speaker pause this long closes the utterance and sends it to STT. */
const SILENCE_MS = 800;

export interface VoiceCaptureOptions {
  db: PeaceDb;
  stt: SpeechToText;
  state: ActiveMeeting;
  log: Logger;

  /** Resolve a user id to a display name for speaker labels. */
  resolveLabel: (userId: string) => string;
  onError: (error: Error) => void;
}

/**
 * Joins a voice channel and turns per-user Opus streams into transcript
 * segments: subscribe on speaking start → decode to PCM → utterance closed
 * by AfterSilence → one chunked STT request → one ConversationEvent.
 * Per-user streams mean diarization is free (speaker = Discord user).
 */
export async function startVoiceCapture (channel: VoiceBasedChannel, options: VoiceCaptureOptions): Promise<VoiceConnection> {
  const connection = joinVoiceChannel({
    channelId     : channel.id,
    guildId       : channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf      : false,
    selfMute      : true
  });

  // Attach observers BEFORE awaiting Ready — handshake failures live there.
  connection.on('stateChange', (oldState, newState) => {
    options.log.debug('voice.connection_state', {
      from: oldState.status,
      to  : newState.status
    });
  });
  connection.on('error', error => {
    options.log.error('voice.connection_error', errorFields(error));
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  } catch (error) {
    connection.destroy();
    options.log.error('voice.connect_timeout', {
      voiceChannelId: channel.id,
      ...errorFields(error)
    });
    throw new Error('voice connection did not become ready within 15s — check the bot\'s Connect permission, the firewall (UDP), and that an encryption library is installed (see voice.dependency_report in the logs)');
  }

  options.log.info('voice.connected', {
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
    options.log.debug('voice.speaking_start', { userId });

    const utteranceStart = Date.now();
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
    const pcmChunks: Buffer[] = [];

    opusStream.pipe(decoder);
    decoder.on('data', (chunk: Buffer) => pcmChunks.push(chunk));

    const finish = () => {
      subscribed.delete(userId);

      const pcm = Buffer.concat(pcmChunks);
      const durationMs = pcm.length / BYTES_PER_SECOND * 1000;

      if (durationMs < MIN_UTTERANCE_MS) {
        options.log.debug('voice.utterance_skipped_short', {
          userId,
          durationMs: Math.round(durationMs)
        });

        return;
      }

      const sttStartedAt = Date.now();

      options.log.debug('voice.utterance_captured', {
        userId,
        durationMs: Math.round(durationMs),
        bytes     : pcm.length
      });
      options.stt.transcribe(pcm, {
        sampleRate: SAMPLE_RATE,
        channels  : CHANNELS
      }).then(result => {
        if (!result) {
          options.log.debug('voice.stt_empty', {
            userId,
            ms: Date.now() - sttStartedAt
          });

          return;
        }

        options.log.info('voice.utterance_transcribed', {
          userId,
          chars     : result.text.length,
          confidence: result.confidence,
          ms        : Date.now() - sttStartedAt
        });
        insertSegments(options.db, [conversationEventSchema.parse({
          id          : randomUUID(),
          meetingId   : options.state.meetingId,
          speakerId   : `discord:${userId}`,
          speakerLabel: options.resolveLabel(userId),
          text        : result.text,
          tStart      : utteranceStart - options.state.startedAt,
          tEnd        : utteranceStart - options.state.startedAt + Math.round(durationMs),
          confidence  : result.confidence,
          source      : 'discord-voice'
        })]);
      })
        .catch((error: unknown) => options.onError(error instanceof Error ? error : new Error(String(error))));
    };

    decoder.once('end', finish);
    opusStream.once('error', (error: Error) => {
      options.log.warn('voice.opus_stream_error', {
        userId,
        ...errorFields(error)
      });
      options.onError(error);
      finish();
    });
  });

  return connection;
}

export function stopVoiceCapture (guildId: string): void {
  getVoiceConnection(guildId)?.destroy();
}
