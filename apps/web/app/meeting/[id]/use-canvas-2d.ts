import { useCallback, useEffect, useState } from 'react';

const KEY = 'peace:canvas2d';

/**
 * Layout dimensionality: the 1-D deck vs the 2-D canvas, persisted per browser and
 * toggleable from the UI. A stored choice wins; otherwise the `NEXT_PUBLIC_CANVAS_2D`
 * env default. Resolved after mount so the choice can't split SSR vs client.
 */
export function useCanvas2D (): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);

    setOn(stored === null ? process.env.NEXT_PUBLIC_CANVAS_2D === '1' : stored === '1');
  }, []);

  const set = useCallback((next: boolean) => {
    setOn(next);

    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // best-effort persistence
    }
  }, []);

  return [on, set];
}
