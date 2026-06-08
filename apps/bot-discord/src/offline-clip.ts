import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AudioFormat } from '@peace/adapters';

/** 20ms of 48kHz stereo s16le — the frame size Discord's player consumes. */
const FRAME_BYTES = 3840;

const CLIP_PATH = join(import.meta.dirname, '..', 'assets', 'offline-degraded.pcm');

/** The pre-rendered clip is stereo 48k so it plays straight through (no up-mix). */
export const OFFLINE_CLIP_FORMAT: AudioFormat = {
  sampleRate: 48000,
  channels  : 2,
  encoding  : 'pcm-s16le'
};

/**
 * Load the pre-rendered "my connection dropped" clip from disk and return a
 * thunk that yields a fresh frame stream per call (replayable). Returns null
 * if the asset is absent — the LivenessController then announces in chat only.
 * Read once at startup; played locally with no network (the whole point).
 *
 * Generate the asset with: pnpm --filter @peace/bot-discord gen-offline-clip
 */
export function loadOfflineClip (): (() => AsyncIterable<Buffer>) | null {
  let data: Buffer;

  try {
    data = readFileSync(CLIP_PATH);
  } catch {
    return null;
  }

  if (data.length === 0) {
    return null;
  }

  return () => (async function* frames () {
    for (let offset = 0; offset < data.length; offset += FRAME_BYTES) {
      yield data.subarray(offset, Math.min(offset + FRAME_BYTES, data.length));
    }
  }());
}
