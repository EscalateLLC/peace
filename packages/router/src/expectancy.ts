import type { RouterConfig } from './heuristics';
import type { ConversationState } from './types';

/**
 * The expectancy monitor — the "helper" half of participation (the reactive
 * observer is `classifyAddress`). It watches for the conversation *waiting* on
 * peace and nudges it even when no reflex cue fired: peace was just part of the
 * exchange, a human turn went unanswered, and the floor has gone quiet — they
 * seem to be waiting. This closes the gap where a follow-up lands just past the
 * reactive window and peace would otherwise sit in silence.
 *
 * Pure over the existing ConversationState (no new state). The router rides this
 * on its 1s clock tick. An LLM "vibe" assessor would later feed the same
 * `prompted` nomination lane — this is the cheap, deterministic backbone.
 */
export interface ExpectancySignal {
  reason: 'waiting';
}

export function evaluateWaitingExpectancy (
  state: ConversationState,
  now: number,
  lastExpectancyAt: number,
  cfg: RouterConfig
): ExpectancySignal | null {
  // Only inside a conversation peace is actually part of — never human-to-human.
  const lastEngagedAt = Math.max(state.lastAddressed?.at ?? 0, state.lastBotSpokeAt);

  if (lastEngagedAt === 0 || now - lastEngagedAt > cfg.expectancyWindowMs) {
    return null;
  }

  // A human turn happened after peace's last turn and is still unanswered.
  if (state.lastHumanSpeechAt <= state.lastBotSpokeAt) {
    return null;
  }

  // The floor is open (no one holding it) and quiet for a beat — but not so long
  // the moment has passed (don't nudge about an exchange that already moved on).
  if (state.speaking.size > 0) {
    return null;
  }

  const sinceHuman = now - state.lastHumanSpeechAt;

  if (sinceHuman < cfg.expectancyMinSilenceMs || sinceHuman > cfg.expectancyMaxSilenceMs) {
    return null;
  }

  // Tap, don't nag.
  if (now - lastExpectancyAt < cfg.expectancyCooldownMs) {
    return null;
  }

  return { reason: 'waiting' };
}
