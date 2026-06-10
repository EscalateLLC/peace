'use client';

import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

const MIN_K = 0.25;
const MAX_K = 4;
const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

interface View {
  x: number;
  y: number;
  k: number;
}

export interface DiagramViewState {
  view: View;
  natural: { w: number; h: number };

  /** True while the canvas is repositioning (resize settle) or the parent flagged it busy. */
  loading: boolean;

  /** Fit the diagram to the container, centred. */
  fit: () => void;

  /** Zoom about the container centre by `factor` (the +/- controls). */
  zoomBy: (factor: number) => void;

  /** Pan handlers for the container (the caller gates them on expanded && !locked). */
  pan: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: () => void;
  };
}

/**
 * The diagram's pan/zoom viewport: a `{x,y,k}` transform over the natural viewBox,
 * fit-centred on render/resize with a settle mask, mousewheel zoom (expanded, not
 * locked), and drag-pan. Split out of MermaidDiagram so the component keeps only
 * render + cross-link wiring.
 */
export function useDiagramView ({ containerRef, svg, expanded, busy, locked }: {
  containerRef: RefObject<HTMLDivElement | null>;
  svg: string;
  expanded: boolean;
  busy: boolean;
  locked: boolean;
}): DiagramViewState {
  const [view, setView] = useState<View>({
    x: 0,
    y: 0,
    k: 1
  });
  const [natural, setNatural] = useState({
    w: 0,
    h: 0
  });
  const [settling, setSettling] = useState(false);
  const viewRef = useRef(view);

  viewRef.current = view;

  const fit = useCallback(() => {
    const root = containerRef.current;
    const svgEl = root?.querySelector('svg');

    if (!root || !svgEl) {
      return;
    }

    const vb = svgEl.viewBox.baseVal;
    const cw = root.clientWidth;
    const ch = root.clientHeight;

    if (!vb.width || !vb.height || !cw || !ch) {
      return;
    }

    // The viewport box owns the natural size (the SVG fills it 100%); the transform
    // owns scaling — so we never mutate the SVG's own width/height (which re-renders reset).
    setNatural({
      w: vb.width,
      h: vb.height
    });

    const k = clampK(Math.min(cw / vb.width, ch / vb.height) * 0.9);

    setView({
      k,
      x: (cw - vb.width * k) / 2,
      y: (ch - vb.height * k) / 2
    });
  }, [containerRef]);

  // Refit when the diagram renders or the panel expands/collapses.
  useEffect(() => {
    if (!svg) {
      return;
    }

    const id = requestAnimationFrame(fit);

    return () => cancelAnimationFrame(id);
  }, [svg, expanded, fit]);

  // Recentre on resize, but mask the reposition with a loading state instead of
  // letting the diagram visibly snap: while the canvas is mid-resize (e.g. a pane
  // minimises) we hide it; once the size settles we refit and reveal it centred.
  useEffect(() => {
    const root = containerRef.current;

    if (!root) {
      return;
    }

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let primed = false;

    const ro = new ResizeObserver(() => {
      if (!primed) {
        primed = true;
        fit();

        return;
      }

      setSettling(true);
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      timer = setTimeout(() => {
        raf = requestAnimationFrame(() => {
          fit();
          setSettling(false);
        });
      }, 180);
    });

    ro.observe(root);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [containerRef, fit]);

  // When a parent-driven layout change (busy) ends, refit so the diagram reveals
  // already centred in its new size.
  useEffect(() => {
    if (busy) {
      return;
    }

    const id = requestAnimationFrame(fit);

    return () => cancelAnimationFrame(id);
  }, [busy, fit]);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView(v => {
      const k = clampK(v.k * factor);
      const f = k / v.k;

      return {
        k,
        x: cx - (cx - v.x) * f,
        y: cy - (cy - v.y) * f
      };
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const root = containerRef.current;

    if (root) {
      zoomAt(root.clientWidth / 2, root.clientHeight / 2, factor);
    }
  }, [containerRef, zoomAt]);

  // Wheel zoom (expanded, not locked) — a native non-passive listener so it can preventDefault.
  useEffect(() => {
    const root = containerRef.current;

    if (!root || !expanded || locked) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Zoom about the container centre so the diagram stays centred as it scales.
      zoomAt(root.clientWidth / 2, root.clientHeight / 2, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };

    root.addEventListener('wheel', onWheel, { passive: false });

    return () => root.removeEventListener('wheel', onWheel);
  }, [containerRef, expanded, locked, zoomAt]);

  const panState = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }

    // A press that starts on the overlay controls/badge must reach their click —
    // don't capture the pointer for a pan (capture would steal the button's click).
    if (e.target instanceof Element && e.target.closest('.dw-diagram-controls, .dw-diagram-lock')) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    panState.current = {
      x : e.clientX,
      y : e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const p = panState.current;

    if (!p) {
      return;
    }

    setView(v => ({
      ...v,
      x: p.vx + (e.clientX - p.x),
      y: p.vy + (e.clientY - p.y)
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    panState.current = null;
  }, []);

  return {
    view,
    natural,
    loading: settling || busy,
    fit,
    zoomBy,
    pan    : {
      onPointerDown,
      onPointerMove,
      onPointerUp
    }
  };
}
