import type { ConversationEvent } from '@peace/core';

/** A speaker reference (mirrors @peace/adapters SpeakerRef without the dependency). */
export interface SpeakerRef {
  speakerId: string;
  speakerLabel: string;
}

// ─── Inputs (router/01 RouterInput union) ────────────────────────────────────

export type RouterInput =
  | { type: 'utterance.committed'; event: ConversationEvent; at: number }
  | { type: 'speaker.start'; speaker: SpeakerRef; at: number }
  | { type: 'speaker.stop'; speaker: SpeakerRef; at: number }
  | { type: 'silence.span'; ms: number; at: number }
  | { type: 'speech.finished'; candidateId: string; at: number }
  | { type: 'speech.aborted'; candidateId: string; reason: string; at: number };

// ─── Candidates ──────────────────────────────────────────────────────────────

export type CandidateKind = 'addressed' | 'follow-up' | 'prompted' | 'proactive';

export interface Candidate {
  id: string;
  kind: CandidateKind;

  /** Who prompted it (addressed/follow-up); null for proactive. */
  addressedBy: SpeakerRef | null;

  /** The question/text directed at the bot, if any. */
  query: string;
  createdAt: number;

  /** Drop the candidate if it hasn't been delivered by this time (H6 staleness). */
  expiresAt: number;

  /** Filled once the agent drafts (the words to say). */
  text?: string;
}

// ─── Conversation state (router/01) ──────────────────────────────────────────

export interface ConversationState {

  /** speakerIds currently holding the floor. */
  speaking: Set<string>;

  /** In-flight bot speech (for barge-in + one-at-a-time). */
  botSpeech: { candidateId: string; startedAt: number } | null;

  /** Epoch ms the bot last finished (registered) a turn; 0 if never. */
  lastBotSpokeAt: number;

  /** Who the bot most recently answered (for follow-up biasing/observability). */
  lastAddressed: { speakerId: string; label: string; at: number } | null;

  /** Rolling unsolicited-speak budget (H5). */
  socialBudget: { spokenThisWindow: number; windowStart: number };

  /** Rolling conversation energy 0..1 (overlap/turn density, H4). */
  energy: number;

  /** Last time any human spoke (for the silence clock). */
  lastHumanSpeechAt: number;
}

// ─── Draft + Executor (injected — keeps the engine platform/model-free) ──────

export interface DraftRequest {
  mode: CandidateKind;

  /** Display name of the addresser; null for proactive. */
  addressedBy: string | null;
  query: string;
}

export type DraftOutcome =
  | { kind: 'speak'; text: string }
  | { kind: 'silent'; reason: string };

/** The conversational agent, injected (bot adapts @peace/agent's draftResponse). */
export type DraftFn = (request: DraftRequest) => Promise<DraftOutcome>;

/** Opaque handle to in-flight bot speech. */
export interface SpeechHandle {
  readonly id: string;
}

/**
 * Platform glue, injected. The router emits intent through these; it never
 * imports a platform SDK. `registerTurn` is the ONLY persistence point — it
 * runs only when a turn is actually delivered (the register-or-discard
 * invariant).
 */
export interface RouterExecutor {

  /** Begin speaking; resolves when playback STARTS (not finishes). */
  speak: (candidate: Candidate) => Promise<SpeechHandle>;
  abortSpeech: (handle: SpeechHandle, reason: string) => void;

  /** Commit a delivered turn to history (persist + workspace). Registration. */
  registerTurn: (candidate: Candidate) => void;

  /** True while a live voice connection exists. */
  isInVoice: () => boolean;
}
