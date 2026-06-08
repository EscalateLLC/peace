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
 * The session orchestrator calls this once per silence-delimited utterance.
 * Text-native sources never touch this interface. Kept permanently as the
 * degradation path under streaming STT (see realtime/01).
 */
export interface SpeechToText {
  transcribe: (pcm: Buffer, format: PcmFormat) => Promise<TranscriptionResult | null>;
}

// ─── Streaming (phase-2 live path) ───────────────────────────────────────────

/**
 * Results from one live STT session, interleaved. `interim` is revisable text
 * that never touches the database; `committed` is final and becomes a
 * ConversationEvent. `speakerTag` carries provider-side diarization for
 * mixed-audio sources (one session for the whole conversation); per-speaker
 * sources already know their speaker and leave diarization off.
 */
export type SttEvent =
  | {
    kind: 'interim';
    text: string;
    speakerTag?: number;
  }
  | {
    kind: 'committed';
    text: string;
    confidence: number;
    speakerTag?: number;

    /** Milliseconds from the session's first audio frame to utterance start. */
    tStartMs: number;
  };

/**
 * One open live-transcription stream. Push frames in as they arrive; pull
 * interleaved results out. close() flushes and ends the stream.
 */
export interface StreamingSttSession {
  push: (frame: Buffer) => void;
  close: () => Promise<void>;
  results: AsyncIterable<SttEvent>;
}

/**
 * Provider-agnostic live STT. Stateless vendor wrapper — one open() per audio
 * source; lifecycle policy (open-on-speech, idle close, pool caps, budget) is
 * the session orchestrator's concern, identical across platforms.
 */
export interface StreamingSpeechToText {
  open: (format: PcmFormat, options?: { diarize?: boolean }) => Promise<StreamingSttSession>;
}

// ─── Text-to-speech (voice output) ───────────────────────────────────────────

/** Which vendor produced a synthesis (so the boundary can detect a fallback switch). */
export type TtsProvider = 'elevenlabs' | 'deepgram';

export interface TtsResult {

  /** Raw PCM (s16le) frames, streamed as synthesis arrives. */
  audio: AsyncIterable<Buffer>;

  /** Shape of the PCM in `audio` (so the platform can up/down-mix as needed). */
  format: PcmFormat;

  /** The provider that produced this audio; the composite sets it so the boundary can notice a fallback. */
  provider?: TtsProvider;
}

/**
 * Provider-agnostic text-to-speech. Mirrors SpeechToText: a stateless vendor
 * wrapper that streams PCM so the first audible frame lands near the
 * provider's first byte (the spoken-reply latency budget). `signal` aborts the
 * synthesis socket mid-stream — the barge-in path (voice/02).
 *
 * Lives in @peace/transcription alongside STT for now (shared provider
 * plumbing + audio-format vocabulary); may become @peace/speech later.
 */
export interface TextToSpeech {
  synthesize: (text: string, opts?: { signal?: AbortSignal }) => Promise<TtsResult>;
}
