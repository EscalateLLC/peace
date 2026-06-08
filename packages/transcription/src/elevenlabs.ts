import { PeaceError, type PeaceErrorCode } from '@peace/core';
import type { TextToSpeech, TtsResult } from './types';
import { streamToBuffers } from './web-stream';

/**
 * HTTP status → error code: auth/billing (401/402/403) is permanent and must be
 * surfaced; 429 is rate-limited; everything else (5xx, odd 4xx) is treated as
 * transient. The composite uses `retryable` only for logging — it always tries
 * the *next provider* regardless, since a different vendor may simply work.
 */
function classifyHttpStatus (status: number): { code: PeaceErrorCode; retryable: boolean } {
  if (status === 401 || status === 402 || status === 403) {
    return {
      code     : 'tts.auth',
      retryable: false
    };
  }

  if (status === 429) {
    return {
      code     : 'tts.rate_limited',
      retryable: true
    };
  }

  return {
    code     : 'tts.transient',
    retryable: true
  };
}

export interface ElevenLabsTtsOptions {

  /** Defaults to ELEVENLABS_API_KEY. */
  apiKey?: string;

  /** Voice id; defaults to PEACE_ELEVENLABS_VOICE or "Rachel". Browse voices at elevenlabs.io. */
  voiceId?: string;

  /** Model; defaults to PEACE_ELEVENLABS_MODEL or eleven_turbo_v2_5 (low-latency, natural). */
  modelId?: string;
}

/** ElevenLabs default "Rachel" — a clear, natural English voice. */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

/** pcm_24000 is the widely-available raw-PCM format; the adapter resamples 24k → 48k. */
const SAMPLE_RATE = 24000;

/**
 * ElevenLabs TTS over the streaming endpoint → raw linear16 PCM (mono 24kHz),
 * streamed so the first audible frame lands near first byte. Plain `fetch` (no
 * vendor SDK, no new dependency). `signal` cancels mid-stream for barge-in.
 */
export function createElevenLabsTts (options: ElevenLabsTtsOptions = {}): TextToSpeech {
  const apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  const voiceId = options.voiceId ?? process.env.PEACE_ELEVENLABS_VOICE ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? process.env.PEACE_ELEVENLABS_MODEL ?? DEFAULT_MODEL_ID;

  return {
    async synthesize (text: string, opts = {}): Promise<TtsResult> {
      let response: Response;

      try {
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_24000`, {
          method : 'POST',
          headers: {
            'xi-api-key'  : apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            text,
            model_id: modelId
          }),
          signal: opts.signal
        });
      } catch (error) {
        // Network/abort failure before any HTTP status — transient by nature.
        throw new PeaceError('tts.transient', {
          message    : `elevenlabs tts request failed: ${error instanceof Error ? error.message : String(error)}`,
          userMessage: 'Could not reach the voice service.',
          retryable  : true,
          cause      : error
        });
      }

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        const { code, retryable } = classifyHttpStatus(response.status);

        throw new PeaceError(code, {
          message    : `elevenlabs tts ${response.status}: ${detail.slice(0, 200)}`,
          userMessage: code === 'tts.auth' ? 'The voice service rejected the request — check the ElevenLabs API key and billing.' : 'The voice service is temporarily unavailable.',
          retryable
        });
      }

      return {
        provider: 'elevenlabs',
        format  : {
          sampleRate: SAMPLE_RATE,
          channels  : 1
        },
        audio: streamToBuffers(response.body, opts.signal)
      };
    }
  };
}
