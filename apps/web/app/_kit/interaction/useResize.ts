import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clampSeamDelta } from './geometry';

/**
 * Drag-to-resize on the gutters, via pointer capture (grabs on the first
 * press). State is set before capture so a rare capture failure can't abort the
 * drag; the spring engine snaps to the live ratios while `draggingRef` is set.
 */
export function useResize (opts: { aw: number; ratios: number[]; setRatios: (r: number[]) => void; minRatio: number }) {
  const { aw, ratios, setRatios, minRatio } = opts;
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragInfo = useRef<{ k: number; startX: number; startRatios: number[] } | null>(null);

  const onSeamDown = (k: number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    dragInfo.current = {
      k,
      startX     : e.clientX,
      startRatios: [...ratios]
    };
    draggingRef.current = true;
    setDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is an optimization; the drag works without it
    }
  };

  const onSeamMove = (e: ReactPointerEvent) => {
    const d = dragInfo.current;

    if (!d || aw <= 0) {
      return;
    }

    const a0 = d.startRatios[d.k]!;
    const b0 = d.startRatios[d.k + 1]!;
    const delta = clampSeamDelta({
      delta: (e.clientX - d.startX) / aw,
      a0,
      b0,
      minRatio
    });

    const next = [...d.startRatios];

    next[d.k] = a0 + delta;
    next[d.k + 1] = b0 - delta;
    setRatios(next);
  };

  const onSeamUp = (e: ReactPointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op if it was never captured
    }

    dragInfo.current = null;
    draggingRef.current = false;
    setDragging(false);
  };

  return {
    dragging,
    draggingRef,
    onSeamDown,
    onSeamMove,
    onSeamUp
  };
}

