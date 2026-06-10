import { useCallback, useEffect, useRef, useState } from 'react';
import type { Id } from './types';

/**
 * Expand/dock state machine. `closing` keeps the overlay mounted for the exit
 * animation (backdrop fade-out, content zoom-out, spring-back) before the
 * expanded panel is finally cleared (after `closeMs`).
 */
export function useExpand (opts: { closeMs?: number } = {}) {
  const closeMs = opts.closeMs ?? 300;
  const [expanded, setExpanded] = useState<Id | null>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openExpand = useCallback((id: Id) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    setClosing(false);
    setExpanded(id);
  }, []);

  const dock = useCallback(() => {
    setClosing(true);

    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      setExpanded(null);
      setClosing(false);
    }, closeMs);
  }, [closeMs]);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  return {
    expanded,
    closing,
    openExpand,
    dock
  };
}
