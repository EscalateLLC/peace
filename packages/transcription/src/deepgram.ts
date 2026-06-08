import { createClient } from '@deepgram/sdk';
import { PeaceError } from '@peace/core';
import type { PcmFormat, SpeechToText, TextToSpeech, TranscriptionResult, TtsResult } from './types';
import { streamToBuffers } from './web-stream';

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

export interface DeepgramTtsOptions {

  /** Defaults to DEEPGRAM_API_KEY. */
  apiKey?: string;

  /** Aura voice; defaults to PEACE_TTS_MODEL or aura-2-thalia-en. */
  model?: string;

  /** PCM sample rate; 48000 matches Discord voice so no resample is needed. */
  sampleRate?: number;
}

const TTS_SAMPLE_RATE = 48000;

/**
 * Deepgram Aura TTS → raw linear16 PCM (mono at `sampleRate`). Streams the
 * response body so the first audible frame lands near Aura's first byte; the
 * caller (platform egress) up-mixes mono→stereo and encodes to Opus. `signal`
 * cancels the synthesis request mid-stream for barge-in.
 */
export function createDeepgramTts (options: DeepgramTtsOptions = {}): TextToSpeech {
  const apiKey = options.apiKey ?? process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set');
  }

  const client = createClient(apiKey);
  const model = options.model ?? process.env.PEACE_TTS_MODEL ?? 'aura-2-thalia-en';
  const sampleRate = options.sampleRate ?? TTS_SAMPLE_RATE;

  return {
    async synthesize (text: string, opts = {}): Promise<TtsResult> {
      let stream: ReadableStream<Uint8Array> | null;

      try {
        const response = await client.speak.request({ text }, {
          model,
          encoding   : 'linear16',
          sample_rate: sampleRate,
          container  : 'none'
        });

        stream = await response.getStream();
      } catch (error) {
        // The SDK abstracts the HTTP status; treat any failure as transient
        // (the boundary decides whether another provider is worth trying).
        throw new PeaceError('tts.transient', {
          message    : `deepgram tts request failed: ${error instanceof Error ? error.message : String(error)}`,
          userMessage: 'The backup voice service is temporarily unavailable.',
          retryable  : true,
          cause      : error
        });
      }

      if (!stream) {
        throw new PeaceError('tts.transient', {
          message    : 'deepgram tts: empty response stream',
          userMessage: 'The backup voice service returned no audio.',
          retryable  : true
        });
      }

      return {
        provider: 'deepgram',
        format  : {
          sampleRate,
          channels: 1
        },
        audio: streamToBuffers(stream, opts.signal)
      };
    }
  };
}
