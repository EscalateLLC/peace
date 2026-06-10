import { describe, expect, it } from 'vitest';
import { deriveCursor, resolveIntent } from './intent';

// A minimal fake Element with just the `closest` behaviour resolveIntent needs
// (node env — no jsdom). `isControl` answers the control selector; `intent`
// answers the `[data-intent]` lookup.
function fakeTarget (opts: { isControl?: boolean; intent?: string }): Element {
  return {
    closest (sel: string) {
      if (sel === '[data-intent]') {
        if (opts.intent === undefined) {
          return null;
        }

        return { getAttribute: () => opts.intent } as unknown as Element;
      }

      return opts.isControl ? ({} as Element) : null;
    }
  } as unknown as Element;
}

describe('resolveIntent', () => {
  it('defaults to surface for an empty / unmarked target', () => {
    expect(resolveIntent({ target: null })).toBe('surface');
    expect(resolveIntent({ target: fakeTarget({}) })).toBe('surface');
  });

  it('classifies genuine controls as control', () => {
    expect(resolveIntent({ target: fakeTarget({ isControl: true }) })).toBe('control');
  });

  it('inherits the nearest data-intent ancestor', () => {
    expect(resolveIntent({ target: fakeTarget({ intent: 'content' }) })).toBe('content');
    expect(resolveIntent({ target: fakeTarget({ intent: 'surface' }) })).toBe('surface');
  });

  it('ignores an unknown data-intent value and falls back to surface', () => {
    expect(resolveIntent({ target: fakeTarget({ intent: 'bogus' }) })).toBe('surface');
  });

  it('lets a genuine control win even inside a content region', () => {
    expect(resolveIntent({
      target: fakeTarget({
        isControl: true,
        intent   : 'content'
      })
    })).toBe('control');
  });
});

describe('deriveCursor', () => {
  it('is grabbing while pressing or dragging, regardless of intent', () => {
    expect(deriveCursor({
      intent  : 'surface',
      phase   : 'press',
      expanded: false
    })).toBe('grabbing');
    expect(deriveCursor({
      intent  : 'content',
      phase   : 'drag',
      expanded: false
    })).toBe('grabbing');
  });

  it('is pointer over a control', () => {
    expect(deriveCursor({
      intent  : 'control',
      phase   : 'idle',
      expanded: false
    })).toBe('pointer');
  });

  it('is zoom-in over content (zoom the element for visibility)', () => {
    expect(deriveCursor({
      intent  : 'content',
      phase   : 'idle',
      expanded: false
    })).toBe('zoom-in');
  });

  it('is zoom-in over a normal surface and zoom-out when expanded', () => {
    expect(deriveCursor({
      intent  : 'surface',
      phase   : 'idle',
      expanded: false
    })).toBe('zoom-in');
    expect(deriveCursor({
      intent  : 'surface',
      phase   : 'idle',
      expanded: true
    })).toBe('zoom-out');
  });
});
