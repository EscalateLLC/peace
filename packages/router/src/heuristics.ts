import { matchWakePhrase } from '@peace/core';
import type { Candidate, ConversationState } from './types';

/**
 * Pure voice-pattern heuristics (router/02). Arithmetic over timestamps + cheap
 * lexical checks — zero LLM, run on every input, all individually testable.
 */

export interface RouterConfig {

  /** A non-wake question still counts as addressed within this long after the bot spoke (H3 follow-up). */
  followUpWindowMs: number;

  /** Staleness TTL for addressed/follow-up candidates (H6). */
  candidateTtlMs: number;

  /** Staleness TTL for proactive candidates (H6). */
  proactiveTtlMs: number;

  /** Silence-gap ladder thresholds (H1). */
  silenceBoundaryMs: number;
  silenceOpenMs: number;
  silenceLullMs: number;

  /** Floor must be open at least this long before the bot may volunteer (proactive). */
  proactiveMinSilenceMs: number;

  /** At most one proactive draft per this interval. */
  proactiveCooldownMs: number;

  /** Unsolicited speaks allowed per rolling window (H5). */
  budgetCap: number;
  budgetWindowMs: number;

  /** Energy band thresholds (H4); proactive is suppressed above medium. */
  energyMediumThreshold: number;
  energyHighThreshold: number;

  // ─── Expectancy monitor (the helper that taps peace when the room waits) ───

  /** How recently peace must have been engaged (addressed or spoke) for expectancy cues to apply. */
  expectancyWindowMs: number;

  /** Quiet-floor beat after an unanswered human turn before peace is nudged (lets them continue first). */
  expectancyMinSilenceMs: number;

  /** Past this much post-turn silence the moment has passed — don't nudge (avoid stale prompts). */
  expectancyMaxSilenceMs: number;

  /** At most one expectancy nudge per this interval (so it taps, never nags). */
  expectancyCooldownMs: number;
}

export const DEFAULT_CONFIG: RouterConfig = {
  followUpWindowMs      : 30000,
  candidateTtlMs        : 8000,
  proactiveTtlMs        : 6000,
  silenceBoundaryMs     : 600,
  silenceOpenMs         : 2000,
  silenceLullMs         : 8000,
  proactiveMinSilenceMs : 2500,
  proactiveCooldownMs   : 30000,
  budgetCap             : 2,
  budgetWindowMs        : 60000,
  energyMediumThreshold : 0.33,
  energyHighThreshold   : 0.66,
  expectancyWindowMs    : 60000,
  expectancyMinSilenceMs: 2500,
  expectancyMaxSilenceMs: 15000,
  expectancyCooldownMs  : 20000
};

// ─── H1: silence-gap ladder ──────────────────────────────────────────────────

export type Floor = 'held' | 'boundary' | 'open' | 'lull';

export function floorFromSilence (silenceMs: number, cfg: RouterConfig): Floor {
  if (silenceMs < cfg.silenceBoundaryMs) {
    return 'held';
  }

  if (silenceMs < cfg.silenceOpenMs) {
    return 'boundary';
  }

  if (silenceMs < cfg.silenceLullMs) {
    return 'open';
  }

  return 'lull';
}

// ─── H2: turn-yield ──────────────────────────────────────────────────────────

const YIELD_TAIL = /\b(?:right|yeah|no|thoughts|you think|agree|make sense|sound good|sound right)\s*\?\s*$/u;

/** The speaker invited a response (trailing question or a yield phrase). */
export function looksLikeTurnYield (text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  return YIELD_TAIL.test(trimmed) || trimmed.endsWith('?');
}

// ─── H3: address (wake pattern + follow-up) ──────────────────────────────────

const INTERROGATIVE_LEAD = new Set([
  'what',
  'why',
  'how',
  'when',
  'where',
  'who',
  'which',
  'should',
  'can',
  'could',
  'would',
  'do',
  'does',
  'did',
  'is',
  'are',
  'was',
  'were',
  'will',
  'any'
]);

/** Cheap "this is a question / second-person" test for follow-up detection. */
export function questionLike (text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.endsWith('?')) {
    return true;
  }

  const first = trimmed.replace(/[^\p{L}\s']/gu, ' ').trim()
    .split(/\s+/u)[0] ?? '';

  if (INTERROGATIVE_LEAD.has(first)) {
    return true;
  }

  return /\b(?:you|your|yours)\b/u.test(trimmed);
}

export interface AddressVerdict {
  kind: 'addressed' | 'follow-up' | null;
  query: string;
}

/**
 * Is this utterance directed at the bot? Explicit wake word → addressed. Else,
 * a question-like utterance within the follow-up window after the bot last
 * spoke → follow-up (from anyone, per the tap-criteria decision).
 */
export function classifyAddress (text: string, now: number, lastBotSpokeAt: number, cfg: RouterConfig): AddressVerdict {
  const wake = matchWakePhrase(text);

  if (wake.matched) {
    return {
      kind : 'addressed',
      query: wake.query
    };
  }

  const withinWindow = lastBotSpokeAt > 0 && now - lastBotSpokeAt <= cfg.followUpWindowMs;

  if (withinWindow && questionLike(text)) {
    return {
      kind : 'follow-up',
      query: text.trim()
    };
  }

  return {
    kind : null,
    query: ''
  };
}

/**
 * Does this utterance lead with an explicit "stop the current speech" signal?
 * Anchored at the start so "wait, what about X" counts as an interruption but
 * "I can wait" does not. Used to barge in on the bot mid-reply WITHOUT the wake
 * word — the natural way people cut in ("hold on…", "stop…").
 */
const INTERRUPT_CUE = /^(?:wait|hold on|hold up|hang on|one (?:sec|second|moment)|stop|shut up|be quiet|quiet|enough|that'?s enough|never\s?mind|forget it|pause)\b/iu;

export function isInterruptCue (text: string): boolean {
  return INTERRUPT_CUE.test(text.trim());
}

// ─── H4: energy ──────────────────────────────────────────────────────────────

export type EnergyLevel = 'low' | 'medium' | 'high';

export function energyLevel (energy: number, cfg: RouterConfig): EnergyLevel {
  if (energy >= cfg.energyHighThreshold) {
    return 'high';
  }

  if (energy >= cfg.energyMediumThreshold) {
    return 'medium';
  }

  return 'low';
}

// ─── H5: social budget ───────────────────────────────────────────────────────

export function budgetAvailable (state: ConversationState, cfg: RouterConfig): boolean {
  return state.socialBudget.spokenThisWindow < cfg.budgetCap;
}

// ─── H6: staleness ───────────────────────────────────────────────────────────

export function isStale (candidate: Candidate, now: number): boolean {
  return now > candidate.expiresAt;
}
