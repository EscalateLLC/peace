import { describe, expect, it } from 'vitest';
import { createDoubleTapDetector } from './useDoubleTap';

describe('createDoubleTapDetector', () => {
  it('fires on two clean taps on the same target within the window', () => {
    const d = createDoubleTapDetector();

    d.down('a', 0, 0);
    expect(d.up(0, 0, 0)).toBeNull(); // first tap arms

    d.down('a', 1, 1);
    expect(d.up(1, 1, 200)).toBe('a'); // second tap → double
  });

  it('does not fire when the gap exceeds the window', () => {
    const d = createDoubleTapDetector(8, 300);

    d.down('a', 0, 0);
    d.up(0, 0, 0);
    d.down('a', 0, 0);
    expect(d.up(0, 0, 400)).toBeNull(); // 400ms > 300ms window
  });

  it('treats a drifting press as a drag, not a tap, and breaks the pair', () => {
    const d = createDoubleTapDetector(8);

    d.down('a', 0, 0);
    expect(d.up(20, 0, 0)).toBeNull(); // moved 20px → a drag

    d.down('a', 0, 0);
    expect(d.up(0, 0, 100)).toBeNull(); // the pair was broken by the drag
  });

  it('does not pair taps on different targets', () => {
    const d = createDoubleTapDetector();

    d.down('a', 0, 0);
    d.up(0, 0, 0);
    d.down('b', 0, 0);
    expect(d.up(0, 0, 100)).toBeNull();
  });

  it('does not pair taps that start far apart', () => {
    const d = createDoubleTapDetector(8);

    d.down('a', 0, 0);
    d.up(0, 0, 0);
    d.down('a', 50, 0);
    expect(d.up(50, 0, 100)).toBeNull(); // second tap starts 50px from the first
  });

  it('reset clears a pending first tap', () => {
    const d = createDoubleTapDetector();

    d.down('a', 0, 0);
    d.up(0, 0, 0);
    d.reset();
    d.down('a', 0, 0);
    expect(d.up(0, 0, 100)).toBeNull();
  });
});
