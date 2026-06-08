import { describe, expect, it } from 'vitest';
import { evaluateWaitingExpectancy } from './expectancy';
import { DEFAULT_CONFIG } from './heuristics';
import { initialState } from './state';
import type { ConversationState } from './types';

const cfg = DEFAULT_CONFIG;

/** Engaged + unanswered: peace spoke at 1000, a human spoke (unanswered) at 2000, floor open. */
function engaged (over: Partial<ConversationState> = {}): ConversationState {
  return {
    ...initialState(0),
    lastBotSpokeAt   : 1000,
    lastHumanSpeechAt: 2000,
    speaking         : new Set<string>(),
    ...over
  };
}

const NEVER = -Infinity; // lastExpectancyAt when no nudge has fired yet

describe('evaluateWaitingExpectancy', () => {
  it('fires when recently engaged, a human turn is unanswered, and the floor is quiet for a beat', () => {
    // now=5000 → 3s since the human turn (within [2500, 15000]).
    expect(evaluateWaitingExpectancy(engaged(), 5000, NEVER, cfg)).toEqual({ reason: 'waiting' });
  });

  it('does not fire when peace was not recently engaged (human-to-human talk)', () => {
    const state = engaged({
      lastBotSpokeAt: 0,
      lastAddressed : null
    });

    expect(evaluateWaitingExpectancy(state, 5000, NEVER, cfg)).toBeNull();
  });

  it('does not fire when the last human turn was already answered', () => {
    const state = engaged({ lastBotSpokeAt: 3000 }); // bot spoke AFTER the human (2000)

    expect(evaluateWaitingExpectancy(state, 5000, NEVER, cfg)).toBeNull();
  });

  it('does not fire before the quiet beat (too soon)', () => {
    // now=3000 → only 1s since the human turn (< 2500).
    expect(evaluateWaitingExpectancy(engaged(), 3000, NEVER, cfg)).toBeNull();
  });

  it('does not fire once the moment has passed (too late)', () => {
    // now=20000 → 18s since the human turn (> 15000).
    expect(evaluateWaitingExpectancy(engaged(), 20000, NEVER, cfg)).toBeNull();
  });

  it('does not fire while someone is holding the floor', () => {
    const state = engaged({ speaking: new Set(['discord:2']) });

    expect(evaluateWaitingExpectancy(state, 5000, NEVER, cfg)).toBeNull();
  });

  it('does not re-fire within the cooldown (taps, never nags)', () => {
    // last nudge at 4000, now 5000 → only 1s < 20s cooldown.
    expect(evaluateWaitingExpectancy(engaged(), 5000, 4000, cfg)).toBeNull();
  });
});
