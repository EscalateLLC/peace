'use client';

import { type CSSProperties, useEffect, useId, useRef, useState } from 'react';
import { type Theme, useTheme } from '@peace/design';
import { useDiagramView } from './use-diagram-view';

// Light peace themes get mermaid's light render; dark themes get dark.
const LIGHT_THEMES: ReadonlySet<Theme> = new Set<Theme>(['cloud', 'confluence', 'bubble']);

export interface DiagramNode {
  id: string;
  label: string;
  evidence: string[];
}

/** Mermaid wraps each flowchart node as `<g class="node" id="<rid>-flowchart-<id>-<n>">`. */
function nodeIdOf (el: Element): string | null {
  return el.id.match(/-flowchart-(.+)-\d+$/)?.[1] ?? null;
}

export function MermaidDiagram ({ source, nodeEvidence, litSegs, onHover, onNode, expanded, busy, locked, onToggleLock }: {
  source: string | null;
  nodeEvidence: Record<string, string[]>;
  litSegs: ReadonlySet<string>;
  onHover: (segIds: readonly string[]) => void;
  onNode: (node: DiagramNode) => void;
  expanded: boolean;
  busy: boolean;

  // When locked, the diagram is under agent control: user pan / zoom / drill are
  // suspended and a locked affordance shows. The reposition itself rides `busy`.
  locked: boolean;
  onToggleLock: () => void;
}) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rid = `dw-mmd-${useId().replace(/[:]/g, '')}`;
  const { view, natural, loading, fit, zoomBy, pan } = useDiagramView({
    containerRef,
    svg,
    expanded,
    busy,
    locked
  });

  // Latest callbacks/data/lock, read by the (rarely re-attached) node + document listeners.
  const live = useRef({
    nodeEvidence,
    onHover,
    onNode,
    locked
  });

  live.current = {
    nodeEvidence,
    onHover,
    onNode,
    locked
  };

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
      if (down && !live.current.locked && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
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
      data-locked={locked || undefined}
      style={{
        '--dw-gx': `${view.x}px`,
        '--dw-gy': `${view.y}px`,
        '--dw-gk': view.k
      } as CSSProperties}
      onPointerDown={expanded && !locked ? pan.onPointerDown : undefined}
      onPointerMove={expanded && !locked ? pan.onPointerMove : undefined}
      onPointerUp={expanded && !locked ? pan.onPointerUp : undefined}
      onPointerCancel={expanded && !locked ? pan.onPointerUp : undefined}
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
      {locked && (
        <button
          type="button"
          className="dw-diagram-lock"
          data-intent="control"
          onClick={onToggleLock}
          aria-label="Unlock diagram">
          <span aria-hidden="true">🔒</span>
          <span className="dw-diagram-lock-text">Locked</span>
        </button>
      )}
      {expanded && (
        <div
          className="dw-diagram-controls"
          data-intent="control">
          <button
            type="button"
            className="dw-dgc"
            onClick={() => zoomBy(1.2)}
            disabled={locked}
            aria-label="Zoom in">+</button>
          <button
            type="button"
            className="dw-dgc"
            onClick={() => zoomBy(1 / 1.2)}
            disabled={locked}
            aria-label="Zoom out">−</button>
          <button
            type="button"
            className="dw-dgc"
            onClick={fit}
            disabled={locked}
            aria-label="Fit to view">⊡</button>
          <button
            type="button"
            className="dw-dgc"
            onClick={onToggleLock}
            data-on={locked || undefined}
            aria-pressed={locked}
            aria-label={locked ? 'Unlock diagram' : 'Lock diagram'}>{locked ? '🔓' : '🔒'}</button>
        </div>
      )}
    </div>
  );
}
