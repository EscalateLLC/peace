import { useCallback, useEffect, useState, type ReactNode } from 'react';
import './zoom-stack.css';

/**
 * The fractal-zoom modal stack (see `_kit/INTENT.md` §5). A `content` control
 * tapped → push a focused modal here; tapping one *while a modal is already open*
 * pushes a **second, stacked** modal. Backdrop-click / Esc pops the top. This is
 * the element-scale sibling of the panel maximize.
 */

export interface ZoomEntry {

  /** Stable key for the zoomed item (re-tapping the same item is a no-op). */
  key: string;

  /** Accessible label for the dialog. */
  title?: string;

  /** The focused content — the drill-down interface for the item. */
  body: ReactNode;
}

export function useZoomStack () {
  const [stack, setStack] = useState<ZoomEntry[]>([]);

  const zoom = useCallback((entry: ZoomEntry) => {
    setStack(s => (s.some(e => e.key === entry.key) ? s : [...s, entry]));
  }, []);

  const pop = useCallback(() => setStack(s => s.slice(0, -1)), []);
  const clear = useCallback(() => setStack([]), []);

  return {
    stack,
    zoom,
    pop,
    clear,
    depth: stack.length
  };
}

/**
 * Renders the modal stack. Mount once at the host root; feed it `useZoomStack()`.
 * Esc and backdrop-click pop the top modal (the host's own Esc handler should
 * defer while `depth > 0`).
 */
export function ZoomStack (props: { stack: ZoomEntry[]; onPop: () => void }) {
  const { stack, onPop } = props;
  const depth = stack.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && depth > 0) {
        onPop();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [depth, onPop]);

  if (depth === 0) {
    return null;
  }

  return (
    <div
      className="pk-zoom-layer"
      data-part="zoom-layer"
    >
      <button
        type="button"
        className="pk-zoom-backdrop"
        aria-label="Close"
        onClick={onPop}
      />
      {stack.map((entry, i) => (
        <div
          key={entry.key}
          className="pk-zoom-card"
          data-part="zoom-card"
          data-top={i === depth - 1 || undefined}
          role="dialog"
          aria-modal="true"
          aria-label={entry.title}
        >
          {entry.body}
        </div>
      ))}
    </div>
  );
}
