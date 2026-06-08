import { PeaceError, asPeaceError } from '@peace/core';
import { createDeepgramTts } from './deepgram';
import { createElevenLabsTts } from './elevenlabs';
import type { TextToSpeech } from './types';

/**
 * Try each provider in order; the first to synthesize wins. On a failure from
 * one provider, move to the next — a different vendor may simply work (e.g.
 * ElevenLabs billing is unpaid but Deepgram is fine). If every provider fails,
 * throw the *primary's* error: it's the most actionable (the configured-first
 * provider is the one the operator expects to work, so "check ElevenLabs
 * billing" beats "the backup also failed").
 */
export function createFallbackTts (providers: TextToSpeech[]): TextToSpeech {
  return {
    async synthesize (text, opts = {}) {
      let primaryError: PeaceError | null = null;

      for (const provider of providers) {
        try {
          return await provider.synthesize(text, opts);
        } catch (error) {
          primaryError ??= asPeaceError(error);
        }
      }

      throw primaryError ?? new PeaceError('tts.unavailable', {
        message    : 'no TTS provider configured',
        userMessage: 'No voice service is configured.'
      });
    }
  };
}

/**
 * Pick the available TTS providers from the environment, in preference order:
 * ElevenLabs first (most natural — the default), then Deepgram Aura as the
 * runtime fallback, else null (no voice output → the boundary degrades to
 * text). The result is swappable precisely because everything downstream
 * consumes the `TextToSpeech` interface, not a vendor.
 */
export function createTextToSpeech (): TextToSpeech | null {
  const providers: TextToSpeech[] = [];

  if (process.env.ELEVENLABS_API_KEY) {
    providers.push(createElevenLabsTts());
  }

  if (process.env.DEEPGRAM_API_KEY) {
    providers.push(createDeepgramTts());
  }

  if (providers.length === 0) {
    return null;
  }

  return createFallbackTts(providers);
}
