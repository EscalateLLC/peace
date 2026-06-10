'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Evidence-linking interaction shared by every mockup: clicking a chip
 * highlights + scrolls its cited transcript segments. The transcript container
 * gets the returned ref; each segment row gets `data-seg={id}`.
 */
export function useEvidenceHighlight () {
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const highlight = useCallback((ids: string[]) => setHighlighted(new Set(ids)), []);
  const clear = useCallback(() => setHighlighted(new Set()), []);

  const first = [...highlighted][0];

  useEffect(() => {
    if (first) {
      containerRef.current
        ?.querySelector(`[data-seg="${first}"]`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block   : 'center'
        });
    }
  }, [first]);

  return {
    highlighted,
    highlight,
    clear,
    containerRef
  };
}
