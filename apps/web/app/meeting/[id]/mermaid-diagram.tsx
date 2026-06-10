'use client';

import { useEffect, useId, useState } from 'react';
import { type Theme, useTheme } from '@peace/design';

// Light peace themes get mermaid's light render; dark themes get dark.
const LIGHT_THEMES: ReadonlySet<Theme> = new Set<Theme>(['cloud', 'confluence', 'bubble']);

export function MermaidDiagram ({ source }: { source: string | null }) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const rid = `dw-mmd-${useId().replace(/[:]/g, '')}`;

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

  if (!source) {
    return <p className="dw-empty">No diagram yet — run <em>regenerate</em>.</p>;
  }

  if (failed) {
    return <p className="dw-empty">Diagram failed to render.</p>;
  }

  return <div
    className="dw-mermaid"
    dangerouslySetInnerHTML={{ __html: svg }} />;
}
