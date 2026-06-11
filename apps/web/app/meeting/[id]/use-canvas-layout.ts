'use client';

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DragState, type Target, useIntentGesture, useSpringLayout } from '../../_kit';
import { IDS, type PanelId } from './panels';
import { type CanvasLayout, type CellRect, layoutStore } from './layout-store';

/** The 8 resize handles. Each letter is an edge it drags (n/s/e/w + corners). */
export const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

// A cols × rows grid, both as fractions of the deck — fully responsive, viewport-bound
// (no scroll) in v1. Cell coords snap; the px geometry is derived each render.
const COLS = 12;
const ROWS = 8;
const PAD = 12;
const GAP = 10;
const MIN_CW = 2;
const MIN_CH = 2;

const DEFAULT_LAYOUT: CanvasLayout = {
  comms: {
    cx: 0,
    cy: 0,
    cw: 3,
    ch: ROWS,
    z : 1
  },
  workflow: {
    cx: 3,
    cy: 0,
    cw: 6,
    ch: ROWS,
    z : 2
  },
  summary: {
    cx: 9,
    cy: 0,
    cw: 3,
    ch: ROWS,
    z : 3
  }
};

const clampRect = (r: CellRect): CellRect => {
  const cw = Math.max(MIN_CW, Math.min(COLS, r.cw));
  const ch = Math.max(MIN_CH, Math.min(ROWS, r.ch));

  return {
    ...r,
    cw,
    ch,
    cx: Math.max(0, Math.min(COLS - cw, r.cx)),
    cy: Math.max(0, Math.min(ROWS - ch, r.cy))
  };
};

const collides = (a: CellRect, b: CellRect): boolean => a.cx < b.cx + b.cw && a.cx + a.cw > b.cx && a.cy < b.cy + b.ch && a.cy + a.ch > b.cy;

/**
 * Pull every box left to fill horizontal gaps (reading order). `fixed` (the box
 * being dragged) stays put so the others settle around it; omit it to compact the
 * whole grid (on drop) into a tidy, gapless arrangement.
 */
const compact = (layout: CanvasLayout, fixed?: PanelId): CanvasLayout => {
  const out = { ...layout };
  const order = IDS.filter(id => id !== fixed).sort((a, b) => layout[a].cx - layout[b].cx || layout[a].cy - layout[b].cy);
  const placed: PanelId[] = fixed ? [fixed] : [];

  for (const id of order) {
    const box = layout[id];
    let cx = box.cx;

    // Scan from the left for the first slot clear of already-placed boxes — finds the
    // free space even when it's beyond the (immovable) dragged box.
    for (let probe = 0; probe <= COLS - box.cw; probe += 1) {
      if (!placed.some(p => collides({
        ...box,
        cx: probe
      }, out[p]))) {
        cx = probe;
        break;
      }
    }

    out[id] = {
      ...box,
      cx
    };
    placed.push(id);
  }

  return out;
};

/**
 * Reflow the grid as a box is dragged to (cx, cy): pin it there, then let the others
 * settle into the leftmost free slots around it — the "drag rearranges the grid"
 * behaviour of a tidy dashboard.
 */
const reflow = (layout: CanvasLayout, id: PanelId, at: { cx: number; cy: number }): CanvasLayout => {
  const out: CanvasLayout = {
    ...layout,
    [id]: clampRect({
      ...layout[id],
      cx: at.cx,
      cy: at.cy
    })
  };

  return compact(out, id);
};

/**
 * The canvas layout strategy: panels are boxes on a snap grid. Dragging a box moves
 * it in 2-D and reflows the others around it (tidy, gapless — drag-to-rearrange);
 * the 8 handles resize, snapping to cells. Drop-in replacement for `useDeckLayout`.
 * Layout persists via `layoutStore` (temporary localStorage; see settings-persistence.md).
 */
export function useCanvasLayout ({ meetingId, expanded, closing, dock, openExpand, zoomDepth }: {
  meetingId: string;
  expanded: string | null;
  closing: boolean;
  dock: () => void;
  openExpand: (id: PanelId) => void;
  zoomDepth: number;
}) {
  const [rects, setRects] = useState<CanvasLayout>(() => layoutStore.load(meetingId) ?? DEFAULT_LAYOUT);

  // Measure the deck (mounts only once data loads) + keep current via a ResizeObserver.
  const deckRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({
    w: 0,
    h: 0
  });

  const setDeck = useCallback((el: HTMLDivElement | null) => {
    deckRef.current = el;
    roRef.current?.disconnect();

    if (!el) {
      roRef.current = null;

      return;
    }

    const measure = () => setSize(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : {
      w: el.clientWidth,
      h: el.clientHeight
    }));

    measure();
    roRef.current = new ResizeObserver(measure);
    roRef.current.observe(el);
  }, []);

  const ready = size.w > 0;

  const cell = useMemo(() => ({
    cw: Math.max(0, (size.w - PAD * 2 - GAP * (COLS - 1)) / COLS),
    ch: Math.max(0, (size.h - PAD * 2 - GAP * (ROWS - 1)) / ROWS)
  }), [size]);

  const rectToPx = useCallback((r: CellRect): Target => ({
    x: PAD + r.cx * (cell.cw + GAP),
    y: PAD + r.cy * (cell.ch + GAP),
    w: r.cw * cell.cw + (r.cw - 1) * GAP,
    h: r.ch * cell.ch + (r.ch - 1) * GAP
  }), [cell]);

  const targets = useMemo(() => {
    const out = {} as Record<PanelId, Target>;

    for (const id of IDS) {
      if (id === expanded && !closing) {
        const mx = Math.round(size.w * 0.05);

        out[id] = {
          x: mx,
          y: PAD,
          w: Math.max(0, size.w - 2 * mx),
          h: Math.max(0, size.h - 2 * PAD)
        };
      } else {
        out[id] = rectToPx(rects[id]);
      }
    }

    return out;
  }, [rects, expanded, closing, size, rectToPx]);

  const drag = useRef<DragState>({
    panel: null,
    x    : 0
  });
  const draggingRef = useRef(false);
  const grab = useRef({
    x: 0,
    y: 0
  });
  const startRef = useRef<CanvasLayout | null>(null);
  const [dragging, setDragging] = useState(false);

  const { setPanelRef, kick } = useSpringLayout({
    ids: IDS,
    targets,
    ready,
    draggingRef,
    drag
  });

  // Bring a panel to front, re-ranking z to stay 1..N (bounded) so the expanded
  // panel's z (CSS, above the backdrop) is always clear of the canvas stack.
  const bringToFront = (id: PanelId, layout: CanvasLayout): CanvasLayout => {
    const maxZ = Math.max(...IDS.map(i => layout[i].z));

    if (layout[id].z === maxZ) {
      return layout;
    }

    const order = IDS.filter(i => i !== id).sort((a, b) => layout[a].z - layout[b].z);

    order.push(id);

    const next = { ...layout } as CanvasLayout;

    order.forEach((i, idx) => {
      next[i] = {
        ...layout[i],
        z: idx + 1
      };
    });

    return next;
  };

  const gesture = useIntentGesture({
    frameInset         : 0.0918,
    isExpanded         : id => expanded === id,
    onZoomTap          : id => (expanded === id ? dock() : openExpand(id as PanelId)),
    onExpandedDragStart: () => dock(),
    onDragStart        : ({ id, clientX, clientY }) => {
      const deck = deckRef.current;
      const panelEl = deck?.querySelector<HTMLElement>(`[data-panel="${id}"]`);
      const pr = panelEl?.getBoundingClientRect();
      const dr = deck?.getBoundingClientRect();

      if (!pr || !dr) {
        return;
      }

      startRef.current = rects;
      grab.current = {
        x: clientX - pr.x,
        y: clientY - pr.y
      };
      drag.current = {
        panel: id,
        x    : pr.x - dr.x,
        y    : pr.y - dr.y
      };
      setDragging(true);
      setRects(prev => bringToFront(id as PanelId, prev));
      kick();
    },
    onDragMove: ({ id, clientX, clientY }) => {
      const dr = deckRef.current?.getBoundingClientRect();
      const start = startRef.current;

      if (!dr || !start) {
        return;
      }

      const x = clientX - grab.current.x - dr.x;
      const y = clientY - grab.current.y - dr.y;

      drag.current = {
        panel: id,
        x,
        y
      };

      // Reflow the others around the cell the dragged box is hovering (from the
      // layout at grab time, so the rearrangement is stable as the pointer moves).
      const cx = Math.round((x - PAD) / (cell.cw + GAP));
      const cy = Math.round((y - PAD) / (cell.ch + GAP));

      setRects(reflow(start, id as PanelId, {
        cx,
        cy
      }));
      kick();
    },
    onDragEnd: () => {
      startRef.current = null;
      drag.current = {
        panel: null,
        x    : 0
      };
      setDragging(false);
      setRects(prev => compact(prev)); // settle into a tidy, gapless grid
      kick();
    }
  });

  // ── resize: each handle snaps the dragged edge(s) to whole grid cells live ──
  const resizeRef = useRef<{ id: PanelId; dir: string; cells: CellRect; sx: number; sy: number; snap: CellRect } | null>(null);

  const resizeProps = (id: PanelId, dir: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) {
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);

      const cells = rects[id];
      const px = rectToPx(cells);

      resizeRef.current = {
        id,
        dir,
        cells,
        sx  : e.clientX,
        sy  : e.clientY,
        snap: cells
      };
      drag.current = {
        panel: id,
        x    : px.x,
        y    : px.y,
        w    : px.w,
        h    : px.h
      };
      setDragging(true);
      setRects(prev => bringToFront(id, prev));
      kick();
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const r = resizeRef.current;

      if (!r) {
        return;
      }

      // Pointer delta → whole-cell delta, so the edge jumps cell-by-cell (snap points).
      const cdx = Math.round((e.clientX - r.sx) / (cell.cw + GAP));
      const cdy = Math.round((e.clientY - r.sy) / (cell.ch + GAP));
      let { cx, cy, cw, ch } = r.cells;

      if (dir.includes('e')) {
        cw = r.cells.cw + cdx;
      }

      if (dir.includes('s')) {
        ch = r.cells.ch + cdy;
      }

      if (dir.includes('w')) {
        cx = r.cells.cx + cdx;
        cw = r.cells.cw - cdx;

        if (cw < MIN_CW) {
          cx -= MIN_CW - cw; // keep the anchored right edge fixed
          cw = MIN_CW;
        }
      }

      if (dir.includes('n')) {
        cy = r.cells.cy + cdy;
        ch = r.cells.ch - cdy;

        if (ch < MIN_CH) {
          cy -= MIN_CH - ch; // keep the anchored bottom edge fixed
          ch = MIN_CH;
        }
      }

      const snap = clampRect({
        z: r.cells.z,
        cx,
        cy,
        cw,
        ch
      });

      r.snap = snap;

      const px = rectToPx(snap);

      drag.current = {
        panel: id,
        x    : px.x,
        y    : px.y,
        w    : px.w,
        h    : px.h
      };
      kick();
    },
    onPointerUp: () => {
      const r = resizeRef.current;

      if (!r) {
        return;
      }

      const { snap } = r;

      resizeRef.current = null;
      drag.current = {
        panel: null,
        x    : 0
      };
      setDragging(false);
      setRects(prev => ({
        ...prev,
        [r.id]: {
          ...snap,
          z: prev[r.id].z
        }
      }));
      kick();
    }
  });

  // Persist (debounced) on layout change.
  useEffect(() => {
    const t = setTimeout(() => layoutStore.save(meetingId, rects), 300);

    return () => clearTimeout(t);
  }, [meetingId, rects]);

  // Esc docks the expanded panel (only when no drill-down modal is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomDepth === 0 && expanded) {
        dock();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [zoomDepth, expanded, dock]);

  return {
    setDeck,
    ready,
    dragging,
    setPanelRef,
    gesture,
    resizeProps,
    zOf: (id: PanelId) => rects[id].z
  };
}
