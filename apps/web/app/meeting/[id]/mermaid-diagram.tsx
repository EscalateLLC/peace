'use client';

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { type Theme, useTheme } from '@peace/design';

// Light peace themes get mermaid's light render; dark themes get dark.
const LIGHT_THEMES: ReadonlySet<Theme> = new Set<Theme>(['cloud', 'confluence', 'bubble']);
const MIN_K = 0.25;
const MAX_K = 4;

export interface DiagramNode {
  id: string;
  label: string;
  evidence: string[];
}

interface View {
  x: number;
  y: number;
  k: number;
}

const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

/** Mermaid wraps each flowchart node as `<g class="node" id="<rid>-flowchart-<id>-<n>">`. */
function nodeIdOf (el: Element): string | null {
  return el.id.match(/-flowchart-(.+)-\d+$/)?.[1] ?? null;
}

export function MermaidDiagram ({ source, nodeEvidence, litSegs, onHover, onNode, expanded, busy }: {
  source: string | null;
  nodeEvidence: Record<string, string[]>;
  litSegs: ReadonlySet<string>;
  onHover: (segIds: readonly string[]) => void;
  onNode: (node: DiagramNode) => void;
  expanded: boolean;
  busy: boolean;
}) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const rid = `dw-mmd-${useId().replace(/[:]/g, '')}`;

  // Latest callbacks/data, read by the (rarely re-attached) node listeners.
  const live = useRef({
    nodeEvidence,
    onHover,
    onNode
  });

  live.current = {
    nodeEvidence,
    onHover,
    onNode
  };

  const viewRef = useRef(view);

  viewRef.current = view;

  useEffect(() => {
    if (!source) {
      setSvg('');
      setFailed(false);

      return;
    }

    let cancelled = false;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad  : false,
          securityLevel: 'strict',
          theme        : LIGHT_THEMES.has(theme) ? 'neutral' : 'dark'
        });

        const { svg: out } = await mermaid.render(rid, source);

        if (!cancelled) {
          setSvg(out);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setSvg('');
          setFailed(true);
        }
      }
    };

    render().catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [source, theme, rid]);

  // ── viewport: fit the diagram to the container, centred ──
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
  }, []);

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
  }, [fit]);

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

  const zoomButton = (factor: number) => () => {
    const root = containerRef.current;

    if (root) {
      zoomAt(root.clientWidth / 2, root.clientHeight / 2, factor);
    }
  };

  // Wheel zoom (expanded only) — a native non-passive listener so it can preventDefault.
  useEffect(() => {
    const root = containerRef.current;

    if (!root || !expanded) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Zoom about the container centre so the diagram stays centred as it scales.
      zoomAt(root.clientWidth / 2, root.clientHeight / 2, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };

    root.addEventListener('wheel', onWheel, { passive: false });

    return () => root.removeEventListener('wheel', onWheel);
  }, [expanded, zoomAt]);

  // ── node hover cross-link wiring (re-wired on any SVG mutation) ──
  useEffect(() => {
    const root = containerRef.current;

    if (!root) {
      return;
    }

    let cleanups: (() => void)[] = [];

    const wire = () => {
      cleanups.forEach(fn => fn());
      cleanups = [];

      root.querySelectorAll<SVGGElement>('.node').forEach(el => {
        const id = nodeIdOf(el);

        if (!id || !live.current.nodeEvidence[id]) {
          return;
        }

        el.classList.add('dw-node-link');
        el.setAttribute('data-intent', 'control');

        const node = (): DiagramNode => ({
          id,
          label   : (el.textContent ?? id).trim(),
          evidence: live.current.nodeEvidence[id]!
        });
        const enter = () => live.current.onHover(node().evidence);
        const leave = () => live.current.onHover([]);

        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          el.removeEventListener('mouseenter', enter);
          el.removeEventListener('mouseleave', leave);
        });
      });
    };

    wire();
    const mo = new MutationObserver(wire);

    mo.observe(root, {
      childList: true,
      subtree  : true
    });

    return () => {
      mo.disconnect();
      cleanups.forEach(fn => fn());
    };
  }, [nodeEvidence]);

  // Drill via DOCUMENT-capture pointerdown→pointerup tap detection — robust against
  // SVG re-renders, the panel gesture, and click-synthesis drift. A tap = down + up
  // on the same node within 8px (a wider move is a pan/drag, not a drill).
  useEffect(() => {
    let down: { x: number; y: number; node: DiagramNode } | null = null;

    const onDown = (e: PointerEvent) => {
      const root = containerRef.current;
      const el = e.target instanceof Element ? e.target.closest('.dw-mermaid .node') : null;
      const id = el && root?.contains(el) ? nodeIdOf(el) : null;
      const evidence = id ? live.current.nodeEvidence[id] : undefined;

      down = id && evidence ? {
        x   : e.clientX,
        y   : e.clientY,
        node: {
          id,
          label: (el?.textContent ?? id).trim(),
          evidence
        }
      } : null;
    };

    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
        live.current.onNode(down.node);
      }

      down = null;
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);

    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, []);

  // Light the nodes whose evidence is currently lit (bidirectional cross-link).
  useEffect(() => {
    const root = containerRef.current;

    if (!root) {
      return;
    }

    root.querySelectorAll<SVGGElement>('.node').forEach(el => {
      const id = nodeIdOf(el);
      const evidence = id ? nodeEvidence[id] : undefined;

      el.classList.toggle('dw-node-lit', Boolean(evidence?.some(segId => litSegs.has(segId))));
    });
  }, [svg, litSegs, nodeEvidence]);

  // ── pan (expanded only) ──
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const onPanDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = {
      x : e.clientX,
      y : e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y
    };
  };

  const onPanMove = (e: ReactPointerEvent) => {
    const p = pan.current;

    if (!p) {
      return;
    }

    setView(v => ({
      ...v,
      x: p.vx + (e.clientX - p.x),
      y: p.vy + (e.clientY - p.y)
    }));
  };

  const onPanUp = () => {
    pan.current = null;
  };

  const loading = settling || busy;

  if (!source) {
    return <p className="dw-empty">No diagram yet — run <em>regenerate</em>.</p>;
  }

  if (failed) {
    return <p className="dw-empty">Diagram failed to render.</p>;
  }

  // `control` while expanded → the panel gesture bails so the diagram owns pan/zoom;
  // collapsed it's a surface (tap empty space to expand, tap a node to drill).
  return (
    <div
      ref={containerRef}
      className="dw-mermaid"
      data-intent={expanded ? 'control' : undefined}
      data-expanded={expanded || undefined}
      data-settling={loading || undefined}
      style={{
        '--dw-gx': `${view.x}px`,
        '--dw-gy': `${view.y}px`,
        '--dw-gk': view.k
      } as CSSProperties}
      onPointerDown={expanded ? onPanDown : undefined}
      onPointerMove={expanded ? onPanMove : undefined}
      onPointerUp={expanded ? onPanUp : undefined}
      onPointerCancel={expanded ? onPanUp : undefined}
    >
      <div
        className="dw-mermaid-vp"
        style={{
          width    : natural.w ? `${natural.w}px` : undefined,
          height   : natural.h ? `${natural.h}px` : undefined,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {loading && (
        <div
          className="dw-mermaid-loading"
          aria-hidden="true">
          <span className="dw-mermaid-spin" />
        </div>
      )}
      {expanded && (
        <div
          className="dw-diagram-controls"
          data-intent="control">
          <button
            type="button"
            className="dw-dgc"
            onClick={zoomButton(1.2)}
            aria-label="Zoom in">+</button>
          <button
            type="button"
            className="dw-dgc"
            onClick={zoomButton(1 / 1.2)}
            aria-label="Zoom out">−</button>
          <button
            type="button"
            className="dw-dgc"
            onClick={fit}
            aria-label="Fit to view">⊡</button>
        </div>
      )}
    </div>
  );
}
