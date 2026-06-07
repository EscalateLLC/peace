import { createClient } from '@deepgram/sdk';
import type { PcmFormat, SpeechToText, TranscriptionResult } from './types';

export interface DeepgramSttOptions {

  /** Defaults to DEEPGRAM_API_KEY. */
  apiKey?: string;
  model?: string;
}

/**
 * Deepgram STT over raw PCM (linear16) — no container re-encode needed after
 * Opus decode. Billed per second of audio, fits many short utterances.
 */
export function createDeepgramStt (options: DeepgramSttOptions = {}): SpeechToText {
  const apiKey = options.apiKey ?? process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set');
  }

  const client = createClient(apiKey);
  const model = options.model ?? 'nova-3';

  return {
    async transcribe (pcm: Buffer, format: PcmFormat): Promise<TranscriptionResult | null> {
      const { result, error } = await client.listen.prerecorded.transcribeFile(pcm, {
        model,
        encoding    : 'linear16',
        sample_rate : format.sampleRate,
        channels    : format.channels,
        smart_format: true,
        punctuate   : true
      });

      if (error) {
        throw new Error(`deepgram: ${error.message}`);
      }

      const alternative = result?.results?.channels?.[0]?.alternatives?.[0];

      if (!alternative || alternative.transcript.trim().length === 0) {
        return null;
      }

      return {
        text      : alternative.transcript.trim(),
        confidence: alternative.confidence ?? 0
      };
    }
  };
}
