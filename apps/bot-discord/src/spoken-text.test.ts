import { describe, expect, it } from 'vitest';
import { applyLexicon, buildLexicon, toSpokenText } from './spoken-text';

describe('toSpokenText', () => {
  it('strips markdown formatting and bullets', () => {
    const md = '**Decisions** (v2)\n- Ship the timeline view\n- Defer the classifier to Q4';
    const spoken = toSpokenText(md);

    expect(spoken).not.toContain('**');
    expect(spoken).not.toContain('- ');
    expect(spoken).not.toContain('(v2)');
    expect(spoken).toContain('Decisions');
    expect(spoken).toContain('Ship the timeline view');
  });

  it('drops fenced code / mermaid blocks', () => {
    const md = 'Here is the flow:\n```mermaid\nflowchart TD\n A --> B\n```\ndone';
    const spoken = toSpokenText(md);

    expect(spoken).not.toContain('flowchart');
    expect(spoken).toContain('Here is the flow');
    expect(spoken).toContain('done');
  });

  it('truncates long replies at a sentence boundary', () => {
    const long = `${'This is a sentence. '.repeat(60)}`;
    const spoken = toSpokenText(long);

    expect(spoken.length).toBeLessThan(640);
    expect(spoken.endsWith('…')).toBe(true);
  });
});

describe('pronunciation lexicon', () => {
  it('respells configured names case-insensitively on word boundaries', () => {
    const lexicon = buildLexicon('{"Xsno":"Ex-no","Sachit":"Suh-cheet"}');

    expect(applyLexicon('Thanks Xsno and sachit', lexicon)).toBe('Thanks Ex-no and Suh-cheet');

    // Word-boundary: does not touch substrings inside other words.
    expect(applyLexicon('Xsnowball', lexicon)).toBe('Xsnowball');
  });

  it('is a no-op for absent or invalid config', () => {
    expect(buildLexicon(undefined)).toEqual([]);
    expect(buildLexicon('not json')).toEqual([]);
    expect(applyLexicon('untouched', [])).toBe('untouched');
  });
});
