import { describe, expect, it, vi } from 'vitest';
import { PeaceError } from '@peace/core';
import { createFallbackTts } from './tts';
import type { TextToSpeech, TtsResult } from './types';

function okProvider (provider: 'elevenlabs' | 'deepgram'): TextToSpeech {
  const result: TtsResult = {
    provider,
    format: {
      sampleRate: 24000,
      channels  : 1
    },
    audio: (async function* () { /* no frames in test */ }())
  };

  return { synthesize: vi.fn().mockResolvedValue(result) };
}

function failingProvider (error: PeaceError): TextToSpeech {
  return { synthesize: vi.fn().mockRejectedValue(error) };
}

const authError = new PeaceError('tts.auth', {
  message    : 'elevenlabs 402',
  userMessage: 'check billing'
});
const transientError = new PeaceError('tts.transient', {
  message    : 'deepgram down',
  userMessage: 'backup unavailable',
  retryable  : true
});

describe('createFallbackTts', () => {
  it('returns the first provider that succeeds', async () => {
    const primary = okProvider('elevenlabs');
    const backup = okProvider('deepgram');
    const tts = createFallbackTts([primary, backup]);

    const result = await tts.synthesize('hi');

    expect(result.provider).toBe('elevenlabs');
    expect(backup.synthesize).not.toHaveBeenCalled();
  });

  it('falls back to the next provider when the first fails', async () => {
    const primary = failingProvider(authError);
    const backup = okProvider('deepgram');
    const tts = createFallbackTts([primary, backup]);

    const result = await tts.synthesize('hi');

    expect(result.provider).toBe('deepgram');
    expect(primary.synthesize).toHaveBeenCalledOnce();
  });

  it('throws the primary error when every provider fails', async () => {
    const tts = createFallbackTts([failingProvider(authError), failingProvider(transientError)]);

    // Primary's error wins — it's the most actionable ("check ElevenLabs billing").
    await expect(tts.synthesize('hi')).rejects.toMatchObject({ code: 'tts.auth' });
  });
});
