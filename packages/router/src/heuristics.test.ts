import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  budgetAvailable,
  classifyAddress,
  energyLevel,
  floorFromSilence,
  isInterruptCue,
  isStale,
  looksLikeTurnYield,
  questionLike
} from './heuristics';
import type { Candidate, ConversationState } from './types';

const cfg = DEFAULT_CONFIG;

describe('isInterruptCue', () => {
  it('fires on a leading stop/wait signal', () => {
    expect(isInterruptCue('wait, that is wrong')).toBe(true);
    expect(isInterruptCue('hold on')).toBe(true);
    expect(isInterruptCue('stop')).toBe(true);
    expect(isInterruptCue('never mind')).toBe(true);
    expect(isInterruptCue('  Hang on a second')).toBe(true);
  });

  it('does not fire on the cue word mid-sentence', () => {
    expect(isInterruptCue('I can wait for the summary')).toBe(false);
    expect(isInterruptCue('let us not stop now')).toBe(false);
    expect(isInterruptCue('that was a great point')).toBe(false);
  });
});

describe('H1 floorFromSilence', () => {
  it('climbs the ladder held → boundary → open → lull', () => {
    expect(floorFromSilence(100, cfg)).toBe('held');
    expect(floorFromSilence(800, cfg)).toBe('boundary');
    expect(floorFromSilence(3000, cfg)).toBe('open');
    expect(floorFromSilence(9000, cfg)).toBe('lull');
  });
});

describe('H2 looksLikeTurnYield', () => {
  it('detects invitations to respond', () => {
    expect(looksLikeTurnYield('we should ship Friday, right?')).toBe(true);
    expect(looksLikeTurnYield('what does everyone think?')).toBe(true);
    expect(looksLikeTurnYield('I will take the spec.')).toBe(false);
  });
});

describe('questionLike', () => {
  it('matches trailing ?, interrogative leads, and second person', () => {
    expect(questionLike('and the budget?')).toBe(true);
    expect(questionLike('what about the timeline')).toBe(true);
    expect(questionLike('can you summarize that')).toBe(true);
    expect(questionLike('we shipped it')).toBe(false);
  });
});

describe('H3 classifyAddress', () => {
  it('flags the wake word as addressed', () => {
    expect(classifyAddress('peace, what did we decide?', 10000, 0, cfg)).toEqual({
      kind : 'addressed',
      query: 'what did we decide'
    });
  });

  it('flags a question soon after the bot spoke as a follow-up (no wake word)', () => {
    const now = 100000;

    expect(classifyAddress('and what about the budget?', now, now - 5000, cfg)).toEqual({
      kind : 'follow-up',
      query: 'and what about the budget?'
    });
  });

  it('does not follow-up outside the window or on non-questions', () => {
    const now = 100000;

    expect(classifyAddress('and the budget?', now, now - 60000, cfg).kind).toBeNull();
    expect(classifyAddress('we shipped it', now, now - 1000, cfg).kind).toBeNull();
    expect(classifyAddress('anything', now, 0, cfg).kind).toBeNull();
  });
});

describe('H4 energyLevel', () => {
  it('bands low/medium/high', () => {
    expect(energyLevel(0.1, cfg)).toBe('low');
    expect(energyLevel(0.4, cfg)).toBe('medium');
    expect(energyLevel(0.8, cfg)).toBe('high');
  });
});

describe('H5 budgetAvailable', () => {
  it('is available below the cap and exhausted at it', () => {
    const base = {
      socialBudget: {
        spokenThisWindow: 1,
        windowStart     : 0
      }
    } as ConversationState;

    expect(budgetAvailable(base, cfg)).toBe(true);
    expect(budgetAvailable({
      ...base,
      socialBudget: {
        spokenThisWindow: 2,
        windowStart     : 0
      }
    } as ConversationState, cfg)).toBe(false);
  });
});

describe('H6 isStale', () => {
  it('is stale past expiry', () => {
    const candidate = { expiresAt: 5000 } as Candidate;

    expect(isStale(candidate, 4000)).toBe(false);
    expect(isStale(candidate, 6000)).toBe(true);
  });
});
