'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTargets,
  computeSlots,
  type DragState,
  focalRatios,
  nearestSlot,
  reorder,
  type Target,
  useIntentGesture,
  useResize,
  useSpringLayout
} from '../../_kit';

export type PanelId = 'comms' | 'workflow' | 'summary';

export const PANELS: { id: PanelId; title: string }[] = [
  {
    id   : 'comms',
    title: 'Conversation'
  },
  {
    id   : 'workflow',
    title: 'Workflow'
  },
  {
    id   : 'summary',
    title: 'Summary'
  }
];

export const IDS: readonly PanelId[] = PANELS.map(p => p.id);

export const PAD = 12;

export const GAP = 10;
const MIN_RATIO = 0.18;
const FOCAL_RATIO = 0.46;

/**
 * The deck's layout engine: measured size → spring-positioned panel rects, with
 * drag-to-reorder + seam-resize + tap-to-expand (the kit's gesture/spring/resize
 * primitives wired together). Split out of DeckWorkspace, which keeps the data,
 * cross-link, and render concerns.
 */
export function useDeckLayout ({ expanded, closing, dock, openExpand, zoomDepth }: {
  expanded: string | null;
  closing: boolean;
  dock: () => void;
  openExpand: (id: PanelId) => void;
  zoomDepth: number;
}) {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({
    w: 0,
    h: 0
  });
  const [order, setOrder] = useState<PanelId[]>(['comms', 'workflow', 'summary']);
  const [ratios, setRatios] = useState<number[]>(focalRatios({
    focal     : 1,
    focalRatio: FOCAL_RATIO
  }));

  // Measure on attach (the deck only mounts once data loads, so a []-deps effect
  // would miss it) and keep current via a ResizeObserver.
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

  const geom = useMemo(() => computeSlots({
    width : size.w,
    height: size.h,
    ratios,
    pad   : PAD,
    gap   : GAP
  }), [size, ratios]);
  const geomRef = useRef(geom);

  geomRef.current = geom;
  const grabRef = useRef(0);
  const ready = size.w > 0;

  const { dragging, draggingRef, onSeamDown, onSeamMove, onSeamUp } = useResize({
    aw      : geom.aw,
    ratios,
    setRatios,
    minRatio: MIN_RATIO
  });

  const targets = useMemo(() => buildTargets({
    ids       : IDS,
    order,
    slots     : geom,
    pad       : PAD,
    expandGeom: id => {
      if (id !== expanded || closing) {
        return null;
      }

      const mx = Math.round(size.w * 0.05);

      return {
        x: mx,
        y: PAD,
        w: Math.max(0, size.w - 2 * mx),
        h: geom.h
      };
    }
  }) as Record<PanelId, Target>, [order, geom, expanded, closing, size]);

  const drag = useRef<DragState>({
    panel: null,
    x    : 0
  });
  const { setPanelRef, kick } = useSpringLayout({
    ids: IDS,
    targets,
    ready,
    draggingRef,
    drag
  });

  const anchorDrag = useCallback((clientX: number) => {
    const deck = deckRef.current;

    return deck ? clientX - deck.getBoundingClientRect().x - grabRef.current : 0;
  }, []);

  const gesture = useIntentGesture({
    // Thinner drag-edge band (default is 0.15) — the grab-cursor frame is less
    // intrusive, leaving more of the panel as the tap-to-zoom interior.
    frameInset         : 0.0918,
    isExpanded         : id => expanded === id,
    onZoomTap          : id => (expanded === id ? dock() : openExpand(id as PanelId)),
    onExpandedDragStart: () => dock(),
    onDragStart        : ({ id, clientX }) => {
      const panelEl = deckRef.current?.querySelector<HTMLElement>(`[data-panel="${id}"]`);

      grabRef.current = clientX - (panelEl?.getBoundingClientRect().x ?? 0);
      drag.current.panel = id;
      drag.current.x = anchorDrag(clientX);
      kick();
    },
    onDragMove: ({ id, clientX }) => {
      const deck = deckRef.current;

      if (!deck) {
        return;
      }

      drag.current.x = anchorDrag(clientX);
      const slot = nearestSlot({
        px: clientX - deck.getBoundingClientRect().x,
        sx: geomRef.current.sx,
        sw: geomRef.current.sw
      });

      setOrder(ord => reorder({
        order: ord,
        id,
        slot
      }) as PanelId[]);
      kick();
    },
    onDragEnd: () => {
      drag.current.panel = null;
      kick();
    }
  });

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
    geom,
    dragging,
    onSeamDown,
    onSeamMove,
    onSeamUp,
    setPanelRef,
    gesture
  };
}
