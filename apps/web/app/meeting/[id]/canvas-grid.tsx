'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import GridLayout, { type Layout, type ResizeHandleAxis, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';

import { useDoubleTap, useExpand } from '../../_kit';
import type { PanelId } from './panels';

// WidthProvider measures the container and feeds `width` to the grid (created once).
// eslint-disable-next-line new-cap -- WidthProvider is an HOC, not a constructor
const ResponsiveGrid = WidthProvider(GridLayout);

const COLS = 12;
const ROWS = 12;
const MARGIN: [number, number] = [10, 10];
const PADDING: [number, number] = [12, 12];

// Full 8-point resize border. Edge handles are thin strips (CSS) so the top one sits
// above the grip without stealing the whole header from the drag gesture.
const RESIZE_HANDLES: ResizeHandleAxis[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

const PANEL_IDS: PanelId[] = ['comms', 'workflow', 'summary'];

/** Reflow modes: RGL gravity compaction by axis (configurable, persisted). Both push
 * neighbours out of the way on collision — the displacement that makes the canvas feel alive. */
type Reflow = 'vertical' | 'horizontal';
const REFLOW: { id: Reflow; label: string }[] = [
  {
    id   : 'horizontal',
    label: 'Columns'
  },
  {
    id   : 'vertical',
    label: 'Stack'
  }
];
const COMPACT: Record<Reflow, 'vertical' | 'horizontal'> = {
  vertical  : 'vertical',
  horizontal: 'horizontal'
};

const cell = (i: PanelId, [x, y, w, h]: [number, number, number, number]): Layout[number] => ({
  i,
  x,
  y,
  w,
  h,
  minW: 2,
  minH: 3
});

/** Named default arrangements — the recovery buttons; `even` is the safe reset. */
const PRESETS: { id: string; label: string; layout: Layout }[] = [
  {
    id    : 'even',
    label : 'Even',
    layout: [cell('comms', [0, 0, 3, ROWS]), cell('workflow', [3, 0, 6, ROWS]), cell('summary', [9, 0, 3, ROWS])]
  },
  {
    id    : 'focus',
    label : 'Focus',
    layout: [cell('workflow', [0, 0, 8, ROWS]), cell('comms', [8, 0, 4, 6]), cell('summary', [8, 6, 4, 6])]
  },
  {
    id    : 'rows',
    label : 'Rows',
    layout: [cell('comms', [0, 0, COLS, 4]), cell('workflow', [0, 4, COLS, 4]), cell('summary', [0, 8, COLS, 4])]
  }
];
const DEFAULT_LAYOUT = PRESETS[0]!.layout;

// Bump when the reflow default changes so old grids adopt the new one (layout kept).
const STORAGE_VERSION = 4;
const storageKey = (meetingId: string): string => `peace:grid:${meetingId}`;

/** The rowHeight that makes ROWS rows exactly fill `height` px — so the grid never scrolls. */
const rowHeightFor = (height: number): number => Math.max(24, Math.floor((height - 2 * PADDING[1] - (ROWS - 1) * MARGIN[1]) / ROWS));

/** Clamp every panel fully inside the grid — auto-corrects a container nudged out of bounds. */
function clampLayout (layout: Layout): Layout {
  return layout.map(l => {
    const w = Math.min(Math.max(l.w, l.minW ?? 2), COLS);
    const h = Math.min(Math.max(l.h, l.minH ?? 3), ROWS);

    return {
      ...l,
      w,
      h,
      x: Math.max(0, Math.min(l.x, COLS - w)),
      y: Math.max(0, Math.min(l.y, ROWS - h))
    };
  });
}

/** A layout is usable only if every panel appears exactly once — otherwise we reset. */
function validLayout (value: unknown): value is Layout {
  if (!Array.isArray(value) || value.length !== PANEL_IDS.length) {
    return false;
  }

  const items = value as { i?: unknown }[];

  return PANEL_IDS.every(id => items.filter(it => it.i === id).length === 1);
}

interface GridState { layout: Layout; reflow: Reflow }

/** Load the saved grid, validating hard — anything unparseable or busted resets to Even. */
function loadState (meetingId: string): GridState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(meetingId)) ?? 'null');

    if (validLayout(parsed)) {
      return {
        layout: parsed,
        reflow: 'horizontal'
      }; // legacy shape: a bare layout array
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { v?: unknown; layout?: unknown; reflow?: unknown };

      if (validLayout(obj.layout)) {
        // Keep the saved reflow only if it was written by this storage version; otherwise
        // adopt the current default (the mode set + default changed).
        const reflow = obj.v === STORAGE_VERSION && typeof obj.reflow === 'string' && obj.reflow in COMPACT ? obj.reflow as Reflow : 'horizontal';

        return {
          layout: obj.layout,
          reflow
        };
      }
    }
  } catch {
    // fall through to the safe default
  }

  return {
    layout: DEFAULT_LAYOUT,
    reflow: 'horizontal'
  };
}

/**
 * Grow panel `id` greedily into the empty cells around it (right, down, left, up until
 * it can't). Returns the new layout, or null if it's hemmed in (no free space) — in
 * which case the caller goes full-screen instead.
 */
function growIntoFreeSpace (layout: Layout, id: string): Layout | null {
  const target = layout.find(l => l.i === id);

  if (!target) {
    return null;
  }

  const others = layout.filter(l => l.i !== id);
  const occupied = (cx: number, cy: number): boolean => others.some(o => cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h);

  const colClear = (cx: number, y0: number, h0: number): boolean => {
    for (let yy = y0; yy < y0 + h0; yy += 1) {
      if (occupied(cx, yy)) {
        return false;
      }
    }

    return true;
  };

  const rowClear = (cy: number, x0: number, w0: number): boolean => {
    for (let xx = x0; xx < x0 + w0; xx += 1) {
      if (occupied(xx, cy)) {
        return false;
      }
    }

    return true;
  };

  let { x, y, w, h } = target;
  let grew = true;

  while (grew) {
    grew = false;

    if (x + w < COLS && colClear(x + w, y, h)) {
      w += 1;
      grew = true;
    }

    if (y + h < ROWS && rowClear(y + h, x, w)) {
      h += 1;
      grew = true;
    }

    if (x > 0 && colClear(x - 1, y, h)) {
      x -= 1;
      w += 1;
      grew = true;
    }

    if (y > 0 && rowClear(y - 1, x, w)) {
      y -= 1;
      h += 1;
      grew = true;
    }
  }

  if (x === target.x && y === target.y && w === target.w && h === target.h) {
    return null; // hemmed in — nothing to grow into
  }

  return layout.map(l => (l.i === id ? {
    ...l,
    x,
    y,
    w,
    h
  } : l));
}

/**
 * The 2-D workspace deck (behind the `NEXT_PUBLIC_CANVAS_2D` flag). Panels are freely
 * placed and sized on react-grid-layout — RGL owns the drag/resize/collision; reflow
 * (compaction) is configurable. A controls bar offers reflow modes and atomic
 * preset/reset layouts so the canvas can always be restored to a known-good state.
 */
export function CanvasGrid ({ meetingId, panels, renderBody }: {
  meetingId: string;
  panels: readonly { id: PanelId; title: string }[];
  renderBody: (panel: { id: PanelId; title: string }, focused: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(48);
  const [state, setState] = useState<GridState>(() => {
    const loaded = loadState(meetingId);

    return {
      ...loaded,
      layout: clampLayout(loaded.layout)
    };
  });
  const { expanded: focusId, closing, openExpand: focusPanel, dock: unfocusPanel } = useExpand();

  const grownRef = useRef<{ id: string; prior: Layout } | null>(null);

  // Double-tap a panel header → grow it into adjacent free space; if it's hemmed in (no
  // free space), go full-screen instead. Double-tap the grown/full-screen panel again to
  // restore.
  const dt = useDoubleTap({
    targetOf   : e => (e.target instanceof Element ? e.target.closest('[data-panel]')?.getAttribute('data-panel') ?? null : null),
    onDoubleTap: id => {
      if (grownRef.current?.id === id) {
        const { prior } = grownRef.current;

        grownRef.current = null;
        setState(s => ({
          ...s,
          layout: prior
        }));

        return;
      }

      if (focusId === id) {
        unfocusPanel();

        return;
      }

      const grown = growIntoFreeSpace(state.layout, id);

      if (grown) {
        grownRef.current = {
          id,
          prior: state.layout
        };
        setState(s => ({
          ...s,
          layout: grown
        }));
      } else {
        focusPanel(id);
      }
    }
  });

  // Size rows to the canvas area so ROWS rows exactly fill it — fixed to its parent,
  // never scrolls.
  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) {
      return undefined;
    }

    const measure = () => {
      if (el.clientHeight > 0) {
        setRowHeight(rowHeightFor(el.clientHeight));
      }
    };

    measure();

    const ro = new ResizeObserver(measure);

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Persist layout + reflow together (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(meetingId), JSON.stringify({
          v: STORAGE_VERSION,
          ...state
        }));
      } catch {
        // best-effort persistence
      }
    }, 300);

    return () => clearTimeout(t);
  }, [meetingId, state]);

  // Esc closes the focus overlay.
  useEffect(() => {
    if (!focusId) {
      return undefined;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        unfocusPanel();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, unfocusPanel]);

  // RGL owns the live + committed layout (its native reflow gives the opportunistic
  // neighbour displacement); we clamp anything out of bounds and persist what it produces.
  const onLayoutChange = useCallback((layout: Layout) => {
    setState(s => ({
      ...s,
      layout: clampLayout(layout)
    }));
  }, []);

  // Atomic: replace the whole layout in one update (fresh clones) — never half-applied.
  const applyPreset = useCallback((layout: Layout) => {
    setState(s => ({
      ...s,
      layout: layout.map(c => ({ ...c }))
    }));
  }, []);

  const setReflow = useCallback((reflow: Reflow) => {
    setState(s => ({
      ...s,
      reflow
    }));
  }, []);

  const focusedPanel = focusId ? panels.find(p => p.id === focusId) ?? null : null;

  return (
    <div className="dw-grid2d">
      <div className="dw-grid-bar">
        <span className="dw-grid-bar-label">reflow</span>
        {REFLOW.map(r => (
          <button
            key={r.id}
            type="button"
            className="dw-grid-btn"
            data-on={state.reflow === r.id}
            onClick={() => setReflow(r.id)}>{r.label}</button>
        ))}
        <span
          className="dw-grid-bar-sep"
          aria-hidden="true" />
        <span className="dw-grid-bar-label">layout</span>
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            className="dw-grid-btn"
            onClick={() => applyPreset(p.layout)}>{p.label}</button>
        ))}
      </div>

      <div
        ref={ref}
        className="dw-grid-canvas">
        <ResponsiveGrid
          className="dw-rgl"
          cols={COLS}
          maxRows={ROWS}
          rowHeight={rowHeight}
          margin={MARGIN}
          containerPadding={PADDING}
          layout={state.layout}
          onLayoutChange={onLayoutChange}
          draggableHandle=".dw-grip"
          resizeHandles={RESIZE_HANDLES}
          compactType={COMPACT[state.reflow]}
          preventCollision={false}
          isBounded={true}>
          {panels.map(p => (
            <div
              key={p.id}
              data-panel={p.id}
              className="dw-panel dw-grid-panel">
              <div
                className="dw-grip"
                {...dt.handlers}>
                <span className="dw-grip-dots"><i /><i /><i /></span>
                <span className="dw-grip-title">{p.title}</span>
              </div>
              <div className={`dw-body${p.id === 'workflow' ? ' dw-body-canvas' : ''}`}>
                {focusId === p.id ? <div className="dw-panel-parked" /> : renderBody(p, false)}
              </div>
            </div>
          ))}
        </ResponsiveGrid>

        {focusedPanel && (
          <>
            <button
              type="button"
              className="dw-backdrop"
              aria-label="Close focus"
              data-closing={closing || undefined}
              onClick={unfocusPanel} />
            <div
              className="dw-panel dw-grid-focus"
              data-panel={focusedPanel.id}
              data-closing={closing || undefined}>
              <div
                className="dw-grip"
                {...dt.handlers}>
                <span className="dw-grip-dots"><i /><i /><i /></span>
                <span className="dw-grip-title">{focusedPanel.title}</span>
                <button
                  type="button"
                  className="dw-dock"
                  onClick={unfocusPanel}>dock ✕</button>
              </div>
              <div className={`dw-body${focusedPanel.id === 'workflow' ? ' dw-body-canvas' : ''}`}>
                {renderBody(focusedPanel, true)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
