'use client';

import { useEffect, useId, useState } from 'react';

export interface MermaidViewProps {
  source: string;

  /** Called when the source fails to parse/render — surfaces the repair path. */
  onError?: (message: string | null) => void;
}

/**
 * Renders Mermaid source to SVG client-side. This is also the authoritative
 * Mermaid validation step (the pipeline only sanity-checks structure);
 * render errors are shown inline with the message.
 */
export function MermaidView ({ source, onError }: MermaidViewProps) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const renderId = useId().replaceAll(':', '');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad  : false,
          theme        : 'dark',
          securityLevel: 'strict'
        });

        const rendered = await mermaid.render(`peace-${renderId}`, source);

        if (!cancelled) {
          setSvg(rendered.svg);
          setError(null);
          onError?.(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          const message = renderError instanceof Error ? renderError.message : String(renderError);

          setSvg('');
          setError(message);
          onError?.(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, renderId, onError]);

  if (error) {
    return (
      <div className="rounded-md border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
        <p className="font-semibold">Diagram failed to render</p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{error}</pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-host flex justify-center [&_svg]:max-w-full"

      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
