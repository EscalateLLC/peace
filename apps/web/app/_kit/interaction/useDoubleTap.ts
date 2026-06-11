import { type PointerEvent as ReactPointerEvent, useMemo, useRef } from 'react';

const DRIFT_PX = 8;
const WINDOW_MS = 300;

interface Down { id: string; x: number; y: number }
interface Tap { id: string; x: number; y: number; t: number }

/**
 * Pure double-tap detector. Feed it pointer down/up positions (+ timestamps); `up`
 * returns the target id on the second qualifying tap, else null. Drift-tolerant — a
 * press that moves more than `driftPx` is a drag, not a tap, and it breaks any pending
 * pair — and time-windowed. No React, so it's unit-testable on its own.
 */
export function createDoubleTapDetector (driftPx = DRIFT_PX, windowMs = WINDOW_MS) {
  let down: Down | null = null;
  let last: Tap | null = null;

  return {
    down (id: string | null, x: number, y: number): void {
      down = id === null ? null : {
        id,
        x,
        y
      };
    },

    /** Returns the id when this up completes a double-tap on the same target, else null. */
    up (x: number, y: number, t: number): string | null {
      const d = down;

      down = null;

      if (!d) {
        return null;
      }

      if (Math.hypot(x - d.x, y - d.y) > driftPx) {
        last = null; // a drag — disqualify, and break any pending pair

        return null;
      }

      if (last && last.id === d.id && t - last.t < windowMs && Math.hypot(d.x - last.x, d.y - last.y) < driftPx) {
        last = null;

        return d.id;
      }

      last = {
        id: d.id,
        x : d.x,
        y : d.y,
        t
      };

      return null;
    },
    reset (): void {
      down = null;
      last = null;
    }
  };
}

export interface DoubleTapOptions {

  /** Resolve the logical target id from a pointerdown; return null to ignore the press. */
  targetOf: (e: ReactPointerEvent) => string | null;
  onDoubleTap: (id: string, e: ReactPointerEvent) => void;
  driftPx?: number;
  windowMs?: number;
}

/**
 * Double-tap on a logical target, composed from pointer events. Robust on touch and
 * safe to layer over a drag handle: a drag moves more than `driftPx` so it never reads
 * as a tap, and we never capture the pointer or `preventDefault` a non-double-tap — so
 * the underlying drag (react-grid-layout, a pan) keeps working untouched.
 */
export function useDoubleTap (opts: DoubleTapOptions): {
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
  };
  reset: () => void;
} {
  const cb = useRef(opts);

  cb.current = opts;

  const detector = useMemo(() => createDoubleTapDetector(opts.driftPx, opts.windowMs), [opts.driftPx, opts.windowMs]);

  return useMemo(() => ({
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        detector.down(e.isPrimary ? cb.current.targetOf(e) : null, e.clientX, e.clientY);
      },
      onPointerUp: (e: ReactPointerEvent) => {
        const id = detector.up(e.clientX, e.clientY, e.timeStamp);

        if (id !== null) {
          e.preventDefault();
          cb.current.onDoubleTap(id, e);
        }
      }
    },
    reset: detector.reset
  }), [detector]);
}
