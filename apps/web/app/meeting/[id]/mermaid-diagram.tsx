'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { type Theme, useTheme } from '@peace/design';

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

export function MermaidDiagram ({ source, nodeEvidence, litSegs, onHover, onNode }: {
  source: string | null;
  nodeEvidence: Record<string, string[]>;
  litSegs: ReadonlySet<string>;
  onHover: (segIds: readonly string[]) => void;
  onNode: (node: DiagramNode) => void;
}) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rid = `dw-mmd-${useId().replace(/[:]/g, '')}`;

  // Latest callbacks/data, read by the (rarely re-attached) node listeners — so the
  // wiring effect only re-runs on a new render, not on every parent render.
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

  // Wire each evidence-bearing node with NATIVE listeners (React onClick on the
  // dangerouslySetInnerHTML SVG is unreliable). Hover cross-links; click drills in.
  useEffect(() => {
    const root = containerRef.current;

    if (!root || !svg) {
      return;
    }

    const cleanups: (() => void)[] = [];

    root.querySelectorAll<SVGGElement>('.node').forEach(el => {
      const id = nodeIdOf(el);

      if (!id || !live.current.nodeEvidence[id]) {
        return;
      }

      el.classList.add('dw-node-link');

      const node = (): DiagramNode => ({
        id,
        label   : (el.textContent ?? id).trim(),
        evidence: live.current.nodeEvidence[id]!
      });
      const enter = () => live.current.onHover(node().evidence);
      const leave = () => live.current.onHover([]);
      const click = () => live.current.onNode(node());

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('click', click);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('click', click);
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, [svg, nodeEvidence]);

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

  // `control` makes the panel's drag/zoom gesture BAIL on diagram pointer-downs, so
  // it never reorders/expands or swallows a node click. Drag/expand via the grip.
  return <div
    ref={containerRef}
    className="dw-mermaid"
    data-intent="control"
    dangerouslySetInnerHTML={{ __html: svg }} />;
}
