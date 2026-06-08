import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './heuristics';
import { initialState, noteProactiveSpoke, reduce, rollBudgetWindow } from './state';
import type { SpeakerRef } from './types';

const alice: SpeakerRef = {
  speakerId   : 'discord:1',
  speakerLabel: 'Alice'
};
const cfg = DEFAULT_CONFIG;

describe('reduce', () => {
  it('tracks the speaking floor', () => {
    let state = initialState(0);

    state = reduce(state, {
      type   : 'speaker.start',
      speaker: alice,
      at     : 1000
    });
    expect(state.speaking.has('discord:1')).toBe(true);

    state = reduce(state, {
      type   : 'speaker.stop',
      speaker: alice,
      at     : 2000
    });
    expect(state.speaking.has('discord:1')).toBe(false);
  });

  it('advances lastBotSpokeAt only on finished, never on abort', () => {
    let state = initialState(0);

    state.botSpeech = {
      candidateId: 'c1',
      startedAt  : 500
    };
    state = reduce(state, {
      type       : 'speech.aborted',
      candidateId: 'c1',
      reason     : 'barge-in',
      at         : 1000
    });
    expect(state.botSpeech).toBeNull();
    expect(state.lastBotSpokeAt).toBe(0); // abort does not register

    state.botSpeech = {
      candidateId: 'c2',
      startedAt  : 2000
    };
    state = reduce(state, {
      type       : 'speech.finished',
      candidateId: 'c2',
      at         : 2500
    });
    expect(state.lastBotSpokeAt).toBe(2500);
  });

  it('raises energy on rapid turns and decays it over silence', () => {
    let state = initialState(0);

    state = reduce(state, {
      type   : 'speaker.start',
      speaker: alice,
      at     : 1000
    });
    const after1 = state.energy;

    state = reduce(state, {
      type   : 'speaker.start',
      speaker: {
        speakerId   : 'discord:2',
        speakerLabel: 'Bob'
      },
      at: 1200
    });
    expect(state.energy).toBeGreaterThan(after1); // rapid second turn → higher

    state = reduce(state, {
      type   : 'speaker.start',
      speaker: alice,
      at     : 1200 + 60000
    });
    expect(state.energy).toBeLessThan(0.4); // long gap decayed it
  });
});

describe('social budget', () => {
  it('counts proactive speaks and rolls the window', () => {
    let state = initialState(0);

    state = noteProactiveSpoke(state, 1000, cfg);
    state = noteProactiveSpoke(state, 2000, cfg);
    expect(state.socialBudget.spokenThisWindow).toBe(2);

    // After the window elapses, the count resets.
    state = rollBudgetWindow(state, 2000 + cfg.budgetWindowMs + 1, cfg);
    expect(state.socialBudget.spokenThisWindow).toBe(0);
  });
});
