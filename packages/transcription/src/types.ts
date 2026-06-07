export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export interface PcmFormat {

  /** Samples per second, e.g. 48000 for Discord voice. */
  sampleRate: number;
  channels: number;
}

/**
 * Speech-to-text over one completed utterance of raw PCM (s16le).
 * Voice adapters call this once per silence-delimited utterance.
 * Text-native sources never touch this interface.
 */
export interface SpeechToText {
  transcribe: (pcm: Buffer, format: PcmFormat) => Promise<TranscriptionResult | null>;
}
