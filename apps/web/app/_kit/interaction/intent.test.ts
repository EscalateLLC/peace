import { describe, expect, it } from 'vitest';
import { deriveCursor, resolveIntent } from './intent';

// A fake Element chain (node env — no jsdom), innermost (target) first. Each level
// is `{ control?, intent? }`; `closest` walks outward and `contains` answers
// ancestry, which is what resolveIntent needs to tell "the control IS the marked
// element" from "the control sits inside a marked region".
function chain (...levels: { control?: boolean; intent?: string }[]): Element {
  const isControl = (l: { control?: boolean; intent?: string }) => Boolean(l.control) || l.intent === 'control';

  const wrap = (start: number): Element => ({
    closest (sel: string) {
      for (let i = start; i < levels.length; i++) {
        const want = sel === '[data-intent]' ? levels[i]!.intent !== undefined : isControl(levels[i]!);

        if (want) {
          return wrap(i);
        }
      }

      return null;
    },
    contains    : (other: Element) => start >= (other as unknown as { __idx: number }).__idx,
    getAttribute: () => levels[start]!.intent ?? null,
    __idx       : start
  } as unknown as Element);

  return wrap(0);
}

describe('resolveIntent', () => {
  it('defaults to surface for an empty / unmarked target', () => {
    expect(resolveIntent({ target: null })).toBe('surface');
    expect(resolveIntent({ target: chain({}) })).toBe('surface');
  });

  it('classifies genuine controls as control', () => {
    expect(resolveIntent({ target: chain({ control: true }) })).toBe('control');
  });

  it('inherits the nearest data-intent ancestor', () => {
    expect(resolveIntent({ target: chain({ intent: 'content' }) })).toBe('content');
    expect(resolveIntent({ target: chain({ intent: 'surface' }) })).toBe('surface');
  });

  it('ignores an unknown data-intent value and falls back to surface', () => {
    expect(resolveIntent({ target: chain({ intent: 'bogus' }) })).toBe('surface');
  });

  it('lets an explicit data-intent on a control override it (e.g. <button data-intent="content">)', () => {
    expect(resolveIntent({
      target: chain({
        control: true,
        intent : 'content'
      })
    })).toBe('content');
  });

  it('still lets a genuine control win when the content region is only an ancestor', () => {
    // target IS the control; the content marking sits on an ancestor → control wins
    expect(resolveIntent({ target: chain({ control: true }, { intent: 'content' }) })).toBe('control');
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
