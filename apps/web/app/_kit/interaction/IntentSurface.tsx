import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { deriveCursor, resolveIntent } from './intent';
import type { Cursor, Id, Intent } from './types';

interface Gesture { id: Id; intent: Intent; pointerId: number; startX: number; startY: number; expandedAtStart: boolean; dragging: boolean }

export interface IntentGestureOptions {

  /** Selector for genuinely-interactive action controls (default = DEFAULT_CONTROL_SELECTOR). */
  controlSelector?: string;

  /** Pixels of movement before a press becomes a drag (default 8). */
  dragThreshold?: number;

  /** Fraction of the panel's edge that reads as the "frame" drag band (default 0.15). */
  frameInset?: number;

  /** Whether a given panel is currently expanded (drives the cursor + dock-on-drag). */
  isExpanded: (id: Id) => boolean;

  /** A tap on empty surface — zoom the panel (host maximizes / minimizes). */
  onZoomTap: (id: Id) => void;

  /** A drag began (with the pointer position, for the host to anchor it). */
  onDragStart: (info: { id: Id; clientX: number; clientY: number }) => void;

  /** The pointer moved while dragging — raw 2D position; the layout strategy interprets it. */
  onDragMove: (info: { id: Id; clientX: number; clientY: number }) => void;

  /** The drag ended (drop). */
  onDragEnd: (info: { id: Id }) => void;

  /** A drag began on an *expanded* panel — host hard-clears the expanded state. */
  onExpandedDragStart?: (id: Id) => void;
}

/**
 * The intent-aware pointer gesture (see `_kit/INTENT.md`). Press-hold + drag
 * reorders the panel from ANY part of it — `surface` (empty space + frame) and
 * `content` (a zoomable element) both arm the drag; only `control` (a genuine
 * action button) is exempt. A clean tap is routed by where it started: `surface`
 * → zoom the panel; `content` → nothing here (the element's own click fires,
 * zooming the element); `control` → its native click. Pointer-capture is deferred
 * until the drag threshold so a tap passes straight through to the element, and a
 * drag suppresses the trailing click.
 *
 * Hardened: ignores non-primary pointers, tears down on pointercancel, and a
 * window pointerup/cancel/blur fallback guarantees no stuck gesture.
 */
export function useIntentGesture (o: IntentGestureOptions) {
  const { controlSelector } = o;
  const threshold = o.dragThreshold ?? 8;
  const frameInset = o.frameInset ?? 0.15;
  const [hover, setHover] = useState<{ id: Id; intent: Intent; frame: boolean } | null>(null);
  const [pressedId, setPressedId] = useState<Id | null>(null);
  const [dragId, setDragId] = useState<Id | null>(null);
  const g = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const finishRef = useRef<(cancel: boolean) => void>(() => undefined);

  const finish = (cancel: boolean) => {
    const d = g.current;

    setPressedId(null);

    if (!d) {
      return;
    }

    if (d.dragging) {
      o.onDragEnd({ id: d.id });
      setDragId(null);
      suppressClick.current = true; // a drag must not also fire the element's click
    } else if (!cancel && d.intent === 'surface') {
      o.onZoomTap(d.id); // tap empty surface → zoom the panel (content taps fire their own click)
    }

    g.current = null;
  };

  finishRef.current = finish;

  useEffect(() => {
    const onWindowEnd = () => {
      if (g.current) {
        finishRef.current(true); // cancel: drop a drag, never fire a tap
      }
    };

    window.addEventListener('pointerup', onWindowEnd);
    window.addEventListener('pointercancel', onWindowEnd);
    window.addEventListener('blur', onWindowEnd);

    return () => {
      window.removeEventListener('pointerup', onWindowEnd);
      window.removeEventListener('pointercancel', onWindowEnd);
      window.removeEventListener('blur', onWindowEnd);
    };
  }, []);

  // Resolve a pointer's intent, with the "frame" override: the outer band of a panel
  // is a drag handle that takes PRIORITY over content — pressing the inset margin
  // drags the panel even over a bubble/card. Genuine controls still own their click.
  // The frame's rest cursor is grab, so the edges advertise drag, the interior zoom.
  const resolve = (e: ReactPointerEvent): { intent: Intent; frame: boolean } => {
    const base = resolveIntent({
      target: e.target instanceof Element ? e.target : null,
      controlSelector
    });

    if (base === 'control') {
      return {
        intent: 'control',
        frame : false
      };
    }

    // A `[data-no-frame]` region opts out of the drag frame — dense interactive lists
    // (e.g. an outline) keep their rows clickable to the edge instead of becoming drag.
    if (e.target instanceof Element && e.target.closest('[data-no-frame]')) {
      return {
        intent: base,
        frame : false
      };
    }

    const r = e.currentTarget.getBoundingClientRect();
    const dx = Math.min(e.clientX - r.left, r.right - e.clientX) / (r.width || 1);
    const dy = Math.min(e.clientY - r.top, r.bottom - e.clientY) / (r.height || 1);
    const frame = dx < frameInset || dy < frameInset;

    return {
      intent: frame ? 'surface' : base, // the frame band drags the panel, over content
      frame
    };
  };

  const onPointerDown = (id: Id) => (e: ReactPointerEvent) => {
    suppressClick.current = false; // a new press clears any stale post-drag suppression

    if (e.button !== 0 || !e.isPrimary || !(e.target instanceof Element)) {
      return;
    }

    const { intent } = resolve(e);

    if (intent === 'control') {
      return; // action controls own their click and aren't drag handles
    }

    // Arm on surface OR content; do NOT capture yet, so a tap passes through to
    // the element's own click. Capture is deferred until the drag threshold.
    g.current = {
      id,
      intent,
      pointerId      : e.pointerId,
      startX         : e.clientX,
      startY         : e.clientY,
      expandedAtStart: o.isExpanded(id),
      dragging       : false
    };
    setPressedId(id);
  };

  const onHoverMove = (id: Id, e: ReactPointerEvent) => {
    if (!(e.target instanceof Element)) {
      setHover(prev => (prev?.id === id ? null : prev));

      return;
    }

    const { intent, frame } = resolve(e);

    setHover({
      id,
      intent,
      frame
    });
  };

  const onPointerMove = (id: Id) => (e: ReactPointerEvent) => {
    const d = g.current;

    if (!d) {
      onHoverMove(id, e);

      return;
    }

    if (e.pointerId !== d.pointerId) {
      return; // a second pointer must not steer this gesture
    }

    // An armed gesture is driven by ANY panel's move handler (a fast drag can
    // cross into another panel before capture engages) — always act on `d.id`.
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < threshold) {
        return;
      }

      d.dragging = true;

      // Now it's a drag — capture so it tracks off-panel, even if it began on content.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture is an optimization; the drag works without it
      }

      if (d.expandedAtStart) {
        o.onExpandedDragStart?.(d.id); // a maximized panel clears so it can be dragged
      }

      o.onDragStart({
        id     : d.id,
        clientX: e.clientX,
        clientY: e.clientY
      });
      setDragId(d.id);
    }

    o.onDragMove({
      id     : d.id,
      clientX: e.clientX,
      clientY: e.clientY
    });
  };

  const onPointerUp = (id: Id) => (e: ReactPointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op if it was never captured
    }

    finish(false);
  };

  const onPointerCancel = () => () => finish(true);

  const onPointerLeave = (id: Id) => () => {
    if (!g.current) {
      setHover(prev => (prev?.id === id ? null : prev));
    }
  };

  // After a drag, swallow the trailing click so a content element doesn't also
  // fire its own action (zoom) on the same gesture.
  const onClickCapture = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const cursorFor = (id: Id): Cursor => {
    if (pressedId === id || dragId === id) {
      return 'grabbing';
    }

    if (hover?.id === id) {
      if (hover.frame) {
        return 'grab'; // the frame band advertises drag at rest
      }

      return deriveCursor({
        intent  : hover.intent,
        phase   : 'idle',
        expanded: o.isExpanded(id)
      });
    }

    return 'default';
  };

  return {
    hoverId    : hover?.id ?? null,
    hoverIntent: hover?.intent ?? null,
    hoverFrame : hover?.frame ?? false,
    pressedId,
    dragId,
    cursorFor,
    handlers   : (id: Id) => ({
      onPointerDown  : onPointerDown(id),
      onPointerMove  : onPointerMove(id),
      onPointerUp    : onPointerUp(id),
      onPointerLeave : onPointerLeave(id),
      onPointerCancel: onPointerCancel(),
      onClickCapture
    })
  };
}

/**
 * A thin reusable container that applies `useIntentGesture` to a single surface:
 * sets the action cursor + `data-hover-intent` (so the host styles the granular
 * highlight from CSS) and wires the pointer handlers. The deck wires the hook
 * onto its bespoke panels directly; this is for the simple reuse case.
 */
export function IntentSurface (props: Omit<IntentGestureOptions, 'isExpanded'> & {
  id: Id;
  expanded: boolean;
  className?: string;
  children: ReactNode;
}) {
  const gesture = useIntentGesture({
    ...props,
    isExpanded: () => props.expanded
  });
  const intentAttr = gesture.hoverId === props.id ? gesture.hoverIntent ?? undefined : undefined;

  return (
    <div
      data-panel={props.id}
      data-hover-intent={intentAttr}
      className={props.className}
      style={{ cursor: gesture.cursorFor(props.id) }}
      {...gesture.handlers(props.id)}
    >
      {props.children}
    </div>
  );
}
