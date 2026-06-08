import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElevenLabsTts } from './elevenlabs';

function mockFetchResponse (status: number, body: string): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok  : status >= 200 && status < 300,
    status,
    body: status >= 200 && status < 300 ? new ReadableStream() : null,
    text: () => Promise.resolve(body)
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createElevenLabsTts', () => {
  it('throws PeaceError tts.auth on 402 (billing)', async () => {
    mockFetchResponse(402, 'payment required');
    const tts = createElevenLabsTts({ apiKey: 'k' });

    await expect(tts.synthesize('hi')).rejects.toMatchObject({
      code     : 'tts.auth',
      retryable: false
    });
  });

  it('throws PeaceError tts.auth on 401', async () => {
    mockFetchResponse(401, 'unauthorized');
    const tts = createElevenLabsTts({ apiKey: 'k' });

    await expect(tts.synthesize('hi')).rejects.toMatchObject({ code: 'tts.auth' });
  });

  it('throws PeaceError tts.rate_limited on 429', async () => {
    mockFetchResponse(429, 'slow down');
    const tts = createElevenLabsTts({ apiKey: 'k' });

    await expect(tts.synthesize('hi')).rejects.toMatchObject({
      code     : 'tts.rate_limited',
      retryable: true
    });
  });

  it('throws PeaceError tts.transient on 503', async () => {
    mockFetchResponse(503, 'unavailable');
    const tts = createElevenLabsTts({ apiKey: 'k' });

    await expect(tts.synthesize('hi')).rejects.toMatchObject({
      code     : 'tts.transient',
      retryable: true
    });
  });

  it('wraps a network failure as tts.transient', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const tts = createElevenLabsTts({ apiKey: 'k' });

    await expect(tts.synthesize('hi')).rejects.toMatchObject({ code: 'tts.transient' });
  });

  it('tags a successful result with provider elevenlabs', async () => {
    mockFetchResponse(200, '');
    const tts = createElevenLabsTts({ apiKey: 'k' });
    const result = await tts.synthesize('hi');

    expect(result.provider).toBe('elevenlabs');
    expect(result.format.sampleRate).toBe(24000);
  });
});
