import { describe, expect, it, vi } from 'vitest';
import { PeaceError } from '@peace/core';
import type { Logger } from '@peace/logger';
import type { Candidate } from '@peace/router';
import type { TtsResult } from '@peace/transcription';
import { createSpeakExecutor, type SpeakExecutorDeps } from './speak-executor';

const log = {
  debug: vi.fn(),
  info : vi.fn(),
  warn : vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  file : ''
} as unknown as Logger;

function candidate (text: string | undefined = 'The deploy finished at 3pm.'): Candidate {
  return {
    id         : 'cand-1',
    kind       : 'addressed',
    addressedBy: null,
    query      : 'when did it finish?',
    createdAt  : 0,
    expiresAt  : 10_000,
    text
  };
}

function ttsResult (provider: 'elevenlabs' | 'deepgram'): TtsResult {
  return {
    provider,
    format: {
      sampleRate: 24000,
      channels  : 1
    },
    audio: (async function* () { /* no frames */ }())
  };
}

function makeDeps (overrides: Partial<SpeakExecutorDeps> = {}): SpeakExecutorDeps {
  return {
    tts            : { synthesize: vi.fn().mockResolvedValue(ttsResult('elevenlabs')) },
    primaryProvider: 'elevenlabs',
    egress         : {
      speak   : vi.fn().mockResolvedValue({ id: 'speech-1' }),
      sendText: vi.fn().mockResolvedValue(undefined)
    },
    toSpokenText : (markdown: string) => markdown,
    onSpoken     : vi.fn(),
    registerText : vi.fn(),
    publishNotice: vi.fn(),
    onVoiceStatus: vi.fn(),
    log,
    ...overrides
  };
}

const authError = new PeaceError('tts.auth', {
  message    : 'elevenlabs 402',
  userMessage: 'The voice service rejected the request.'
});

describe('createSpeakExecutor', () => {
  it('on success returns a candidate-keyed handle and wires the maps, no notice', async () => {
    const deps = makeDeps();
    const { speak } = createSpeakExecutor(deps);

    const handle = await speak(candidate());

    expect(handle).toEqual({ id: 'cand-1' });
    expect(deps.onSpoken).toHaveBeenCalledWith('cand-1', { id: 'speech-1' });
    expect(deps.publishNotice).not.toHaveBeenCalled();
    expect(deps.registerText).not.toHaveBeenCalled();
  });

  it('on TTS failure delivers the answer in text, registers it, surfaces a notice, and re-throws', async () => {
    const deps = makeDeps({ tts: { synthesize: vi.fn().mockRejectedValue(authError) } });
    const { speak } = createSpeakExecutor(deps);

    await expect(speak(candidate())).rejects.toMatchObject({ code: 'tts.auth' });

    expect(deps.egress.sendText).toHaveBeenCalledOnce();

    const sentText = (deps.egress.sendText as ReturnType<typeof vi.fn>).mock.calls.at(0)?.at(0) as string;

    expect(sentText).toContain('The deploy finished at 3pm.');
    expect(sentText).toContain('voice unavailable');
    expect(deps.registerText).toHaveBeenCalledOnce();
    expect(deps.publishNotice).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      code    : 'tts.auth'
    }));
    expect(deps.onSpoken).not.toHaveBeenCalled();
  });

  it('surfaces the failure notice only once per episode', async () => {
    const deps = makeDeps({ tts: { synthesize: vi.fn().mockRejectedValue(authError) } });
    const { speak } = createSpeakExecutor(deps);

    await speak(candidate()).catch(() => undefined);
    await speak(candidate()).catch(() => undefined);

    expect(deps.publishNotice).toHaveBeenCalledOnce();
    expect(deps.registerText).toHaveBeenCalledTimes(2); // every answer still reaches the user as text
  });

  it('announces a backup-voice switch once (banner + chat) and reports backup status', async () => {
    const deps = makeDeps({ tts: { synthesize: vi.fn().mockResolvedValue(ttsResult('deepgram')) } });
    const { speak } = createSpeakExecutor(deps);

    await speak(candidate());
    await speak(candidate());

    expect(deps.publishNotice).toHaveBeenCalledOnce();
    expect(deps.publishNotice).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }));

    // Also told the people in the call, once.
    expect(deps.egress.sendText).toHaveBeenCalledOnce();
    expect(deps.onVoiceStatus).toHaveBeenCalledWith('backup');
  });

  it('with no TTS configured, degrades straight to text + an unavailable notice', async () => {
    const deps = makeDeps({
      tts            : null,
      primaryProvider: null
    });
    const { speak } = createSpeakExecutor(deps);

    await expect(speak(candidate())).rejects.toMatchObject({ code: 'tts.unavailable' });
    expect(deps.egress.sendText).toHaveBeenCalledOnce();
    expect(deps.registerText).toHaveBeenCalledOnce();
  });
});
