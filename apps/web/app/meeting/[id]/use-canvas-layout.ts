'use client';

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DragState, type Target, useIntentGesture, useSpringLayout } from '../../_kit';
import { IDS, type PanelId } from './panels';
import { type CanvasLayout, type CellRect, layoutStore } from './layout-store';

/** 1-D layout: panels resize horizontally only (the 2-D/free engine lives behind a flag). */
export const RESIZE_DIRS = ['e', 'w'] as const;

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

/**
 * Lay the boxes out left-to-right, packed contiguously in reading order (no gaps,
 * no overlap). Packing in order *preserves the sequence* — the dragged box's cx
 * decides its slot, the rest keep their order — so dragging across reorders cleanly
 * instead of letting a narrow box slip into a gap a wider one couldn't take.
 */
const compact = (layout: CanvasLayout): CanvasLayout => {
  const out = { ...layout };
  const order = IDS.slice().sort((a, b) => layout[a].cx - layout[b].cx || layout[a].cy - layout[b].cy);
  let cx = 0;

  for (const id of order) {
    out[id] = {
      ...layout[id],
      cx
    };
    cx += layout[id].cw;
  }

  return out;
};

/**
 * Reorder the row as a box is dragged: drop it at the insertion point where its
 * centre falls among the *closed-up* others (the slots they'd take without it), so a
 * small drag past a neighbour swaps them — and the same whichever box you grab. Then
 * pack the row contiguously (gapless, order preserved).
 */
const reflow = (layout: CanvasLayout, id: PanelId, at: { cx: number; cy: number }): CanvasLayout => {
  // 1-D: panels stay in the single row (cy 0, full height); only the column order moves.
  const dragged = clampRect({
    ...layout[id],
    cx: at.cx,
    cy: 0
  });
  const centre = at.cx + dragged.cw / 2;
  const others = IDS.filter(other => other !== id).sort((a, b) => layout[a].cx - layout[b].cx);

  let index = others.length;
  let cursor = 0;

  for (let i = 0; i < others.length; i += 1) {
    const w = layout[others[i]!].cw;

    if (cursor + w / 2 > centre) {
      index = i;
      break;
    }

    cursor += w;
  }

  const order = [...others.slice(0, index), id, ...others.slice(index)];
  const out: CanvasLayout = {
    ...layout,
    [id]: dragged
  };
  let cx = 0;

  for (const pid of order) {
    out[pid] = {
      ...out[pid],
      cx
    };
    cx += out[pid].cw;
  }

  return out;
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
    onDragMove: ({ id, clientX }) => {
      const dr = deckRef.current?.getBoundingClientRect();
      const start = startRef.current;

      if (!dr || !start) {
        return;
      }

      // 1-D: only x tracks the pointer; the box stays in its row (y springs to target).
      const x = clientX - grab.current.x - dr.x;

      drag.current = {
        panel: id,
        x
      };

      // Reflow the row around the column the dragged box is over (from the layout at
      // grab time, so the rearrangement is stable as the pointer moves).
      const cx = Math.round((x - PAD) / (cell.cw + GAP));

      setRects(reflow(start, id as PanelId, {
        cx,
        cy: 0
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

  // ── resize: a split — dragging an edge grows this panel and shrinks the neighbour
  // across that boundary by the same amount, so the row always stays full (never any
  // free space). Snaps to whole cells. An outer (canvas) edge has no neighbour → inert.
  const resizeRef = useRef<{
    id: PanelId;
    neighbour: PanelId;
    idCw: number;
    nbCw: number;
    idCx: number;
    nbCx: number;
    grows: 'e' | 'w';
    sx: number;
  } | null>(null);

  const resizeProps = (id: PanelId, dir: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) {
        return;
      }

      const row = IDS.slice().sort((a, b) => rects[a].cx - rects[b].cx);
      const neighbour = dir === 'e' ? row[row.indexOf(id) + 1] : row[row.indexOf(id) - 1];

      if (!neighbour) {
        return; // the outer canvas edge has nothing to resize against
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        id,
        neighbour,
        idCw : rects[id].cw,
        nbCw : rects[neighbour].cw,
        idCx : rects[id].cx,
        nbCx : rects[neighbour].cx,
        grows: dir as 'e' | 'w',
        sx   : e.clientX
      };
      setDragging(true);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const r = resizeRef.current;

      if (!r) {
        return;
      }

      // Whole-cell delta (live snap); positive = this panel grows, the neighbour shrinks.
      const raw = Math.round((e.clientX - r.sx) / (cell.cw + GAP));
      const grow = Math.max(MIN_CW - r.idCw, Math.min(r.nbCw - MIN_CW, r.grows === 'e' ? raw : -raw));

      setRects(prev => ({
        ...prev,
        [r.id]: {
          ...prev[r.id],
          cw: r.idCw + grow,
          cx: r.grows === 'w' ? r.idCx - grow : r.idCx
        },
        [r.neighbour]: {
          ...prev[r.neighbour],
          cw: r.nbCw - grow,
          cx: r.grows === 'e' ? r.nbCx + grow : r.nbCx
        }
      }));
      kick();
    },
    onPointerUp: () => {
      resizeRef.current = null;
      setDragging(false);
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
