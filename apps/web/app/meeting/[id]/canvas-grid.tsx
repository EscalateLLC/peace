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

// Top edge is the drag grip, so resize lives on the other three edges + the bottom
// corners — no handle ever fights the grip for the pointer.
const RESIZE_HANDLES: ResizeHandleAxis[] = ['s', 'e', 'w', 'se', 'sw'];

const PANEL_IDS: PanelId[] = ['comms', 'workflow', 'summary'];

/** Reflow modes: free placement, or RGL's gravity compaction (configurable, persisted). */
type Reflow = 'free' | 'vertical' | 'horizontal';
const REFLOW: { id: Reflow; label: string }[] = [
  {
    id   : 'free',
    label: 'Free'
  },
  {
    id   : 'vertical',
    label: 'Stack'
  },
  {
    id   : 'horizontal',
    label: 'Pack'
  }
];
const COMPACT: Record<Reflow, 'vertical' | 'horizontal' | null> = {
  free      : null,
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

const storageKey = (meetingId: string): string => `peace:grid:${meetingId}`;

/** The rowHeight that makes ROWS rows exactly fill `height` px — so the grid never scrolls. */
const rowHeightFor = (height: number): number => Math.max(24, Math.floor((height - 2 * PADDING[1] - (ROWS - 1) * MARGIN[1]) / ROWS));

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
        reflow: 'free'
      }; // legacy shape: a bare layout array
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as { layout?: unknown; reflow?: unknown };

      if (validLayout(obj.layout)) {
        const reflow = typeof obj.reflow === 'string' && obj.reflow in COMPACT ? obj.reflow as Reflow : 'free';

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
    reflow: 'free'
  };
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
  const [state, setState] = useState<GridState>(() => loadState(meetingId));
  const { expanded: focusId, closing, openExpand: focusPanel, dock: unfocusPanel } = useExpand();

  // Double-tap a panel grip → maximize it to a focus overlay; double-tap again restores.
  const dt = useDoubleTap({
    targetOf   : e => (e.target instanceof Element ? e.target.closest('[data-panel]')?.getAttribute('data-panel') ?? null : null),
    onDoubleTap: id => (focusId === id ? unfocusPanel() : focusPanel(id))
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
        localStorage.setItem(storageKey(meetingId), JSON.stringify(state));
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

  const onLayoutChange = useCallback((layout: Layout) => {
    setState(s => ({
      ...s,
      layout
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
          preventCollision={false}>
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
