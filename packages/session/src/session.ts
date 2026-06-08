import { randomUUID } from 'node:crypto';
import { conversationEventSchema, type ConversationEvent, type ConversationEventStream } from '@peace/core';
import type { PlatformAdapter, SpeakerRef, VoiceIngress } from '@peace/adapters';
import { insertSegments, type PeaceDb } from '@peace/db';
import { errorFields, type Logger } from '@peace/logger';
import type { SpeechToText, StreamingSpeechToText } from '@peace/transcription';
import { createBackendHealth } from './liveness';

/** Utterances shorter than this are dropped (coughs, key clicks). */
const MIN_UTTERANCE_MS = 350;

export interface LiveSessionDeps {
  adapter: PlatformAdapter;

  /** Batch STT: the permanent voice path until streaming lands, then the degradation path. */
  batchStt: SpeechToText | null;

  /** Streaming STT (phase-2 live path). Seam only — not consumed yet. */
  stt: StreamingSpeechToText | null;
  db: PeaceDb;
  meetingId: string;

  /** Epoch ms of meeting start; segment times are relative to it. */
  startedAt: number;
  log: Logger;

  /**
   * Fired for every committed segment, after the DB write — the transport
   * layer's attachment point (it assigns seq and fans out). Unsequenced here:
   * the session knows nothing about sockets. Must not throw; failures in
   * delivery must never break the commit path.
   */
  onDelta?: (delta: { type: 'segment.committed'; payload: ConversationEvent }) => void;

  /**
   * Backend (STT) health transitions — the liveness contract's detection half
   * (realtime/06). Fired edge-triggered after N consecutive STT failures /
   * the first recovery. The host wires these to a LivenessController.
   */
  onBackendDegraded?: () => void;
  onBackendRecovered?: () => void;

  /**
   * Turn-taking presence signal forwarded from the platform adapter — the
   * barge-in trigger (a human starting to speak while the bot is speaking) and
   * the future router's input. Must not throw.
   */
  onSpeaking?: (speaker: SpeakerRef, state: 'start' | 'stop') => void;
}

export interface LiveSession {

  /** Connect the platform and begin ingesting. */
  start: () => Promise<void>;

  /** Disconnect and wait for in-flight voice commits to land. */
  stop: () => Promise<void>;

  /**
   * Committed segments as the existing pull seam. Single consumer; buffering
   * begins at the first call (earlier events live in the DB, not the stream).
   */
  events: () => ConversationEventStream;
}

/**
 * The platform-agnostic composition root for one live meeting: takes any
 * PlatformAdapter, owns STT and persistence, and commits ConversationEvents.
 * Replaying a transcript fixture and sitting in a live call run this exact
 * code path — that equivalence is the architecture's load-bearing claim.
 *
 * Later rounds attach here, not to platform code: incremental analysis and
 * the WS transport consume the commit point; the participation router
 * consumes onSpeaking/interims and acts through adapter.egress.
 */
export function createLiveSession (deps: LiveSessionDeps): LiveSession {
  const { adapter, db, log } = deps;
  const pendingVoice = new Set<Promise<void>>();
  const health = createBackendHealth({
    onDegraded: () => {
      log.warn('session.backend_degraded', { meetingId: deps.meetingId });
      deps.onBackendDegraded?.();
    },
    onRecovered: () => {
      log.info('session.backend_recovered', { meetingId: deps.meetingId });
      deps.onBackendRecovered?.();
    }
  });
  let subscriber: {
    queue: ConversationEvent[];
    notify: (() => void) | null;
    ended: boolean;
  } | null = null;

  function commit (event: ConversationEvent): void {
    insertSegments(db, [event]);

    if (subscriber) {
      subscriber.queue.push(event);
      subscriber.notify?.();
    }

    try {
      deps.onDelta?.({
        type   : 'segment.committed',
        payload: event
      });
    } catch (error) {
      // Fan-out is never on the correctness path (realtime/01).
      log.warn('session.delta_failed', {
        meetingId: deps.meetingId,
        ...errorFields(error)
      });
    }
  }

  function endEventStream (): void {
    if (subscriber) {
      subscriber.ended = true;
      subscriber.notify?.();
    }
  }

  function handleVoice (ingress: VoiceIngress): void {
    if (ingress.kind === 'mixed') {
      // Mixed-audio platforms need streaming STT with diarization — the seam
      // exists (deps.stt), the consumption lands with the realtime round.
      log.warn('session.voice_unsupported', {
        meetingId: deps.meetingId,
        kind     : ingress.kind
      });

      return;
    }

    const task = transcribeUtterance(ingress).catch((error: unknown) => {
      log.error('session.error', {
        meetingId: deps.meetingId,
        ...errorFields(error)
      });
    });

    pendingVoice.add(task);
    task.finally(() => pendingVoice.delete(task)).catch(() => undefined);
  }

  async function transcribeUtterance (ingress: VoiceIngress & { kind: 'per-speaker' }): Promise<void> {
    const frames: Buffer[] = [];

    for await (const frame of ingress.audio) {
      frames.push(frame);
    }

    const pcm = Buffer.concat(frames);
    const bytesPerSecond = ingress.format.sampleRate * ingress.format.channels * 2;
    const durationMs = pcm.length / bytesPerSecond * 1000;

    if (durationMs < MIN_UTTERANCE_MS) {
      log.debug('session.utterance_skipped_short', {
        meetingId : deps.meetingId,
        speakerId : ingress.speaker.speakerId,
        durationMs: Math.round(durationMs)
      });

      return;
    }

    if (!deps.batchStt) {
      log.error('session.stt_unavailable', {
        meetingId: deps.meetingId,
        speakerId: ingress.speaker.speakerId
      });

      return;
    }

    const sttStartedAt = Date.now();

    log.debug('session.utterance_captured', {
      meetingId : deps.meetingId,
      speakerId : ingress.speaker.speakerId,
      durationMs: Math.round(durationMs),
      bytes     : pcm.length
    });

    let result;

    try {
      result = await deps.batchStt.transcribe(pcm, {
        sampleRate: ingress.format.sampleRate,
        channels  : ingress.format.channels
      });
      health.recordSuccess();
    } catch (error) {
      health.recordFailure();
      throw error;
    }

    if (!result) {
      log.debug('session.stt_empty', {
        meetingId: deps.meetingId,
        speakerId: ingress.speaker.speakerId,
        ms       : Date.now() - sttStartedAt
      });

      return;
    }

    const tStart = ingress.startedAt - deps.startedAt;
    const event = conversationEventSchema.parse({
      id          : randomUUID(),
      meetingId   : deps.meetingId,
      speakerId   : ingress.speaker.speakerId,
      speakerLabel: ingress.speaker.speakerLabel,
      text        : result.text,
      tStart,
      tEnd        : tStart + Math.round(durationMs),
      confidence  : result.confidence,
      source      : {
        platform: adapter.platform,
        medium  : 'voice'
      }
    });

    commit(event);
    log.info('session.committed', {
      meetingId : deps.meetingId,
      speakerId : event.speakerId,
      medium    : 'voice',
      chars     : event.text.length,
      confidence: event.confidence,
      ms        : Date.now() - sttStartedAt
    });
  }

  return {
    start: async () => {
      log.info('session.started', {
        meetingId   : deps.meetingId,
        platform    : adapter.platform,
        capabilities: adapter.capabilities
      });

      await adapter.connect({
        onText: event => {
          commit(event);
          log.debug('session.committed', {
            meetingId: deps.meetingId,
            speakerId: event.speakerId,
            medium   : 'text',
            chars    : event.text.length
          });
        },

        onVoice: handleVoice,

        onSpeaking: (speaker, state) => {
          // Router presence signal + barge-in trigger; also the replay corpus
          // the router will be tested against.
          log.debug('session.speaking', {
            meetingId: deps.meetingId,
            speakerId: speaker.speakerId,
            state
          });
          deps.onSpeaking?.(speaker, state);
        },

        onClosed: () => {
          log.info('session.closed', { meetingId: deps.meetingId });
          endEventStream();
        },

        onError: error => {
          log.error('session.error', {
            meetingId: deps.meetingId,
            ...errorFields(error)
          });
        }
      });
    },

    stop: async () => {
      await adapter.disconnect();
      await Promise.all([...pendingVoice]);
      endEventStream();
      log.info('session.stopped', {
        meetingId: deps.meetingId,
        platform : adapter.platform
      });
    },

    events: () => {
      subscriber ??= {
        queue : [],
        notify: null,
        ended : false
      };

      const sub = subscriber;

      return (async function* stream () {
        for (;;) {
          while (sub.queue.length > 0) {
            yield sub.queue.shift() as ConversationEvent;
          }

          if (sub.ended) {
            return;
          }

          await new Promise<void>(resolve => {
            // The notifier clears itself so no state is written after await.
            sub.notify = () => {
              sub.notify = null;
              resolve();
            };
          });
        }
      }());
    }
  };
}
