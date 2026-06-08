import type { ConversationEvent, ConversationPlatform } from '@peace/core';

/**
 * The platform-adapter contract: what any conversation platform (Discord,
 * Zoom, WhatsApp, Apple Messages, phone, transcript replay…) implements so
 * that everything downstream — session orchestration, STT, analysis, the
 * participation router — stays platform-agnostic.
 *
 * The contract lives here; SDK-bound implementations live next to their SDK
 * (e.g. DiscordPlatformAdapter in apps/bot-discord) so this package keeps its
 * core-only dependency footprint. Downstream code adapts via `capabilities`,
 * never by branching on `platform`.
 *
 * Shape: adapters PUSH (live platforms are callback-driven at the edge); the
 * session orchestrator bridges push→pull once, exposing the existing
 * ConversationEventStream to analysis. Raw audio within one ingress is pulled
 * (a bounded AsyncIterable of frames).
 */

export interface AudioFormat {

  /** e.g. 48000 (Discord), 16000 (Zoom SDK), 8000 (phone). */
  sampleRate: number;
  channels: number;

  /** Small closed set; grows deliberately with new platform integrations. */
  encoding: 'pcm-s16le' | 'opus' | 'mulaw';
}

export interface SpeakerRef {

  /** Platform-namespaced id (see speakerId() in @peace/core). */
  speakerId: string;
  speakerLabel: string;
}

/**
 * Voice ingress, variant 1: the platform provides one audio stream per
 * speaker with identity attached — diarization is free (Discord receiver,
 * Zoom SDK raw streams).
 */
export interface PerSpeakerAudio {
  kind: 'per-speaker';
  speaker: SpeakerRef;
  format: AudioFormat;

  /** Epoch ms when this stream began (speech onset) — segment timing derives from it. */
  startedAt: number;

  /** Raw audio frames for one utterance/stream; ends when the platform closes it. */
  audio: AsyncIterable<Buffer>;
}

/**
 * Voice ingress, variant 2: one mixed stream for the whole conversation —
 * speaker attribution is delegated to STT-side diarization (WhatsApp group
 * audio, dialed-in phone). Synthetic speaker ids are minted downstream from
 * diarization tags, under the same speakerId() grammar.
 */
export interface MixedAudio {
  kind: 'mixed';
  format: AudioFormat;

  /** Epoch ms when this stream began. */
  startedAt: number;
  audio: AsyncIterable<Buffer>;
}

export type VoiceIngress = PerSpeakerAudio | MixedAudio;

/**
 * What a platform can do. Downstream behavior differences key off these
 * booleans — never off the platform name.
 */
export interface PlatformCapabilities {

  /** Egress audio (TTS playback) is possible. */
  canSpeak: boolean;

  /** Voice ingress arrives as 'per-speaker' (true) or 'mixed' (false). */
  hasPerSpeakerAudio: boolean;

  /** Human speech onset is detectable while the bot is speaking (enables barge-in). */
  supportsBargeIn: boolean;
  canSendText: boolean;
  hasTextIngress: boolean;

  /** Native capture format; null for text-only platforms. */
  audioFormat: AudioFormat | null;
}

/**
 * Registered by the session orchestrator on connect. Adapters push into
 * these; they never touch STT or the database themselves.
 */
export interface PlatformHandlers {

  /** A complete text utterance, already normalized (text needs no STT). */
  onText: (event: ConversationEvent) => void;

  /** A new voice stream began. Raw frames — transcription is not the adapter's concern. */
  onVoice: (ingress: VoiceIngress) => void;

  /** Turn-taking presence signal (the participation router's raw input). */
  onSpeaking: (speaker: SpeakerRef, state: 'start' | 'stop') => void;

  /**
   * The conversation ended from the platform side (replay exhausted, Zoom
   * meeting ended, call hung up) — as opposed to us calling disconnect().
   */
  onClosed: () => void;
  onError: (error: Error) => void;
}

/** Opaque handle to one in-flight bot speech, for barge-in cancellation. */
export interface SpeechHandle {
  readonly id: string;
}

/**
 * Outbound actions. The seam exists now because the participation router's
 * effect executor (speak / send_chat / abort_speech) is its consumer; voice
 * egress implementations land with the TTS round. Adapters whose
 * capabilities exclude an action may throw from it — callers must gate on
 * capabilities first.
 */
export interface PlatformEgress {
  sendText: (text: string) => Promise<void>;

  /** Play synthesized audio into the conversation. Resolves when playback starts. */
  speak: (pcm: AsyncIterable<Buffer>, format: AudioFormat) => Promise<SpeechHandle>;

  /** Barge-in: stop playback fast (≤200ms budget — see realtime/01). */
  abortSpeech: (handle: SpeechHandle, reason: string) => void;
}

/**
 * One platform's attachment to one conversation. Lifecycle: construct →
 * connect(handlers) → events flow → disconnect.
 */
export interface PlatformAdapter {
  readonly platform: ConversationPlatform;
  readonly capabilities: PlatformCapabilities;
  readonly egress: PlatformEgress;
  connect: (handlers: PlatformHandlers) => Promise<void>;
  disconnect: () => Promise<void>;
}
