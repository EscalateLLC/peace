import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConversationEvent } from '@peace/core';
import { createTranscriptReplayAdapter, type PlatformAdapter, type PlatformHandlers } from '@peace/adapters';
import { createDb, createMeeting, getSegments, migrate, type PeaceDb } from '@peace/db';
import { createLogger } from '@peace/logger';
import type { SpeechToText } from '@peace/transcription';
import { createLiveSession } from './session';

const FORMAT = {
  sampleRate: 8000,
  channels  : 1,
  encoding  : 'pcm-s16le'
} as const;
const BYTES_PER_SECOND = FORMAT.sampleRate * FORMAT.channels * 2;

let dir: string;
let db: PeaceDb;
let meetingId: string;

const log = createLogger('session-test', { dir: join(tmpdir(), 'peace-session-test-logs') });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'peace-session-'));
  db = createDb({ path: join(dir, 'test.db') });
  migrate(db);
  meetingId = createMeeting(db, {
    title    : 'Session test',
    platform : 'upload',
    startedAt: 1000
  }).id;
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, {
    recursive: true,
    force    : true
  });
});

function pcmOfMs (ms: number): Buffer {
  return Buffer.alloc(Math.round(ms / 1000 * BYTES_PER_SECOND));
}

async function* frames (...buffers: Buffer[]): AsyncIterable<Buffer> {
  for (const buffer of buffers) {
    yield buffer;
  }
}

/** A minimal fake voice platform: the test pushes ingress through it. */
function createFakeVoiceAdapter () {
  let handlers: PlatformHandlers | null = null;
  let disconnected = false;

  const adapter: PlatformAdapter = {
    platform    : 'fake-platform',
    capabilities: {
      canSpeak          : false,
      hasPerSpeakerAudio: true,
      supportsBargeIn   : false,
      canSendText       : false,
      hasTextIngress    : false,
      audioFormat       : FORMAT
    },
    egress: {
      sendText: () => Promise.reject(new Error('cannot')),
      speak   : () => Promise.reject(new Error('cannot')),

      abortSpeech: () => {
        throw new Error('cannot');
      }
    },

    connect: connectHandlers => {
      handlers = connectHandlers as PlatformHandlers;

      return Promise.resolve();
    },

    disconnect: () => {
      disconnected = true;

      return Promise.resolve();
    }
  };

  return {
    adapter,
    emitVoice: (startedAt: number, audio: AsyncIterable<Buffer>) => {
      handlers?.onVoice({
        kind   : 'per-speaker',
        speaker: {
          speakerId   : 'fake-platform:42',
          speakerLabel: 'Speaker 42'
        },
        format: FORMAT,
        startedAt,
        audio
      });
    },
    wasDisconnected: () => disconnected
  };
}

function fixedStt (text: string, delayMs = 0): SpeechToText {
  return {
    transcribe: async pcm => {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      return {
        text      : `${text} (${pcm.length}b)`,
        confidence: 0.9
      };
    }
  };
}

describe('createLiveSession + transcript replay (the seam proof)', () => {
  it('drives a replayed transcript through the same commit path as live', async () => {
    const transcript = [
      '[00:05] Alice: We should ship the Discord bot first.',
      '[00:12] Bob: Agreed, voice gives us diarization for free.'
    ].join('\n');

    const session = createLiveSession({
      adapter: createTranscriptReplayAdapter({
        content: transcript,
        meetingId
      }),
      batchStt : null,
      stt      : null,
      db,
      meetingId,
      startedAt: 1000,
      log
    });

    const streamed: ConversationEvent[] = [];
    const consuming = (async () => {
      for await (const event of session.events()) {
        streamed.push(event);
      }
    })();

    await session.start();
    await session.stop();
    await consuming;

    const segments = getSegments(db, meetingId);

    expect(segments.map(segment => segment.speakerId)).toEqual(['user:alice', 'user:bob']);
    expect(segments[0]?.source).toEqual({
      platform: 'upload',
      medium  : 'text'
    });

    // The pull stream saw exactly what the DB saw, in order, exactly once.
    expect(streamed.map(event => event.id)).toEqual(segments.map(segment => segment.id));
  });
});

describe('createLiveSession voice path', () => {
  it('buffers per-speaker audio, transcribes, and commits with platform-derived source', async () => {
    const fake = createFakeVoiceAdapter();
    const session = createLiveSession({
      adapter  : fake.adapter,
      batchStt : fixedStt('hello world'),
      stt      : null,
      db,
      meetingId,
      startedAt: 1000,
      log
    });

    await session.start();
    fake.emitVoice(3000, frames(pcmOfMs(300), pcmOfMs(300)));
    await session.stop();

    const [segment] = getSegments(db, meetingId);

    expect(segment).toMatchObject({
      speakerId   : 'fake-platform:42',
      speakerLabel: 'Speaker 42',
      tStart      : 2000,
      tEnd        : 2600,
      confidence  : 0.9,
      source      : {
        platform: 'fake-platform',
        medium  : 'voice'
      }
    });
    expect(fake.wasDisconnected()).toBe(true);
  });

  it('drops utterances under the minimum duration', async () => {
    const fake = createFakeVoiceAdapter();
    const session = createLiveSession({
      adapter  : fake.adapter,
      batchStt : fixedStt('should never be called'),
      stt      : null,
      db,
      meetingId,
      startedAt: 1000,
      log
    });

    await session.start();
    fake.emitVoice(3000, frames(pcmOfMs(100)));
    await session.stop();

    expect(getSegments(db, meetingId)).toEqual([]);
  });

  it('stop() waits for in-flight transcriptions to commit', async () => {
    const fake = createFakeVoiceAdapter();
    const session = createLiveSession({
      adapter  : fake.adapter,
      batchStt : fixedStt('slow result', 50),
      stt      : null,
      db,
      meetingId,
      startedAt: 1000,
      log
    });

    await session.start();
    fake.emitVoice(2000, frames(pcmOfMs(500)));
    await session.stop();

    expect(getSegments(db, meetingId)).toHaveLength(1);
  });
});
