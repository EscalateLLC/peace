import { describe, expect, it } from 'vitest';
import { chunkMessage } from './chunk';
import { parseIntent } from './commands';

describe('parseIntent', () => {
  it('maps natural phrasings to intents', () => {
    expect(parseIntent('summarize what we have so far')).toBe('summarize');
    expect(parseIntent('what decisions have we made?')).toBe('decisions');
    expect(parseIntent('list the action items')).toBe('actions');
    expect(parseIntent('any open questions left?')).toBe('questions');
    expect(parseIntent('draw an architecture diagram')).toBe('diagram');
    expect(parseIntent('please start')).toBe('start');
    expect(parseIntent('join us')).toBe('join');
    expect(parseIntent('ok stop now')).toBe('stop');
    expect(parseIntent('help')).toBe('help');
    expect(parseIntent('hello there')).toBeNull();
  });
});

describe('chunkMessage', () => {
  it('passes short messages through', () => {
    expect(chunkMessage('hi')).toEqual(['hi']);
  });

  it('splits long messages under the limit on line boundaries', () => {
    const lines = Array.from({ length: 100 }, (unused, index) => `line ${index} ${'x'.repeat(40)}`);
    const chunks = chunkMessage(lines.join('\n'), 500);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(500));
    expect(chunks.join('\n').replaceAll(/\n?```\n?/gu, '')).toContain('line 99');
  });

  it('re-opens code fences across chunk boundaries', () => {
    const mermaid = `\`\`\`mermaid\n${Array.from({ length: 50 }, (unused, index) => `  A${index} --> B${index}`).join('\n')}\n\`\`\``;
    const chunks = chunkMessage(mermaid, 400);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      // Every chunk must contain balanced fences.
      const fences = chunk.split('\n').filter(line => line.trimStart().startsWith('```')).length;

      expect(fences % 2).toBe(0);
    }
  });
});
