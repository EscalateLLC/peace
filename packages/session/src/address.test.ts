import { describe, expect, it } from 'vitest';
import { matchWakePhrase } from './address';

describe('matchWakePhrase', () => {
  it('matches the wake word at the start, with the rest as the query', () => {
    expect(matchWakePhrase('Peace, what did we decide?')).toEqual({
      matched: true,
      query  : 'what did we decide'
    });
    expect(matchWakePhrase('peace summarize the call')).toEqual({
      matched: true,
      query  : 'summarize the call'
    });
  });

  it('allows one leading filler and a trailing "bot"', () => {
    expect(matchWakePhrase('hey peace, give me the action items').matched).toBe(true);
    expect(matchWakePhrase('ok peace bot summarize')).toEqual({
      matched: true,
      query  : 'summarize'
    });
  });

  it('does not trigger on the word mid-sentence', () => {
    expect(matchWakePhrase('I think world peace is the goal').matched).toBe(false);
    expect(matchWakePhrase('we made peace with the deadline').matched).toBe(false);
  });

  it('handles bare address and empty input', () => {
    expect(matchWakePhrase('Peace?')).toEqual({
      matched: true,
      query  : ''
    });
    expect(matchWakePhrase('   ').matched).toBe(false);
  });
});
