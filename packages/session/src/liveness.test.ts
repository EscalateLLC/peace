import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AudioFormat } from '@peace/adapters';
import { createLogger } from '@peace/logger';
import { createBackendHealth, createLivenessController } from './liveness';

const log = createLogger('liveness-test', { dir: join(tmpdir(), 'peace-liveness-test-logs') });

const CLIP_FORMAT: AudioFormat = {
  sampleRate: 48000,
  channels  : 2,
  encoding  : 'pcm-s16le'
};

describe('createBackendHealth', () => {
  it('degrades after N consecutive failures and recovers on first success — edge-triggered', () => {
    const onDegraded = vi.fn();
    const onRecovered = vi.fn();
    const health = createBackendHealth({
      threshold: 2,
      onDegraded,
      onRecovered
    });

    health.recordFailure();
    expect(health.degraded).toBe(false);
    expect(onDegraded).not.toHaveBeenCalled();

    health.recordFailure();
    expect(health.degraded).toBe(true);
    expect(onDegraded).toHaveBeenCalledTimes(1);

    // Further failures don't re-fire.
    health.recordFailure();
    expect(onDegraded).toHaveBeenCalledTimes(1);

    health.recordSuccess();
    expect(health.degraded).toBe(false);
    expect(onRecovered).toHaveBeenCalledTimes(1);

    // A success while healthy doesn't fire recovered.
    health.recordSuccess();
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('a success resets the streak before the threshold', () => {
    const onDegraded = vi.fn();
    const health = createBackendHealth({
      threshold  : 3,
      onDegraded,
      onRecovered: vi.fn()
    });

    health.recordFailure();
    health.recordFailure();
    health.recordSuccess();
    health.recordFailure();
    health.recordFailure();

    expect(onDegraded).not.toHaveBeenCalled();
  });
});

describe('createLivenessController', () => {
  function setup (isInVoice: boolean) {
    const speak = vi.fn().mockResolvedValue({ id: 'h' });
    const sendText = vi.fn().mockResolvedValue(undefined);
    const controller = createLivenessController({
      egress: {
        speak,
        sendText
      },
      isInVoice   : () => isInVoice,
      degradedClip: () => (async function* () {
        yield Buffer.alloc(4);
      }()),
      clipFormat          : CLIP_FORMAT,
      degradedChatMessage : 'my connection dropped',
      recoveredChatMessage: 'reconnected',
      log
    });

    return {
      controller,
      speak,
      sendText
    };
  }

  it('announces in voice + chat once per episode', () => {
    const { controller, speak, sendText } = setup(true);

    controller.onDegraded();
    controller.onDegraded(); // suppressed

    expect(speak).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledTimes(1);

    controller.onRecovered();
    expect(sendText).toHaveBeenCalledTimes(2); // recovery chat

    // New episode announces again.
    controller.onDegraded();
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('falls back to chat-only when not in voice', () => {
    const { controller, speak, sendText } = setup(false);

    controller.onDegraded();

    expect(speak).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledTimes(1);
  });
});
