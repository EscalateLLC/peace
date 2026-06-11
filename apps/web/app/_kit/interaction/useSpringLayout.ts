import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { type AnimState, type DragState, type Id, type Target } from './types';
import { DEFAULT_SPRING, springAxes, type Spring } from './spring';

/**
 * Spring-animates each panel's transform/size (x, y, w, h) toward its target
 * geometry, imperatively (rAF + direct style writes — no React render per
 * frame). Snaps on first layout, springs on every change after; the loop
 * self-parks at rest.
 *
 * Layout-agnostic: it consumes whatever per-id `Target {x,y,w,h}` the caller's
 * layout strategy produces, so it already supports 2D layouts — the deck just
 * happens to vary only x/w today. A dragged panel snaps to `drag.x` (and
 * `drag.y` if a 2D strategy provides it) while the others spring around it.
 */
export function useSpringLayout (opts: {
  ids: readonly Id[];
  targets: Record<Id, Target>;
  ready: boolean;
  draggingRef: { current: boolean };
  drag: { current: DragState };
  spring?: Spring;
}) {
  const { ids, targets, ready, draggingRef, drag } = opts;
  const spring = opts.spring ?? DEFAULT_SPRING;

  const panelEls = useRef(new Map<Id, HTMLElement>());
  const animRef = useRef(new Map<Id, AnimState>());
  const targetsRef = useRef<Record<Id, Target>>({} as never);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef(0);
  const initDone = useRef(false);

  const setPanelRef = useCallback((id: Id) => (el: HTMLElement | null) => {
    if (el) {
      panelEls.current.set(id, el);
    } else {
      panelEls.current.delete(id);
    }
  }, []);

  const apply = useCallback((id: Id) => {
    const el = panelEls.current.get(id);
    const a = animRef.current.get(id);

    if (el && a) {
      el.style.transform = `translate3d(${a.x}px, ${a.y}px, 0)`;
      el.style.width = `${a.w}px`;
      el.style.height = `${a.h}px`;
    }
  }, []);

  const frame = useCallback((ts: number) => {
    const dt = Math.min(0.032, (ts - lastTs.current) / 1000 || 0.016);

    lastTs.current = ts;

    let moving = false;

    for (const id of ids) {
      const t = targetsRef.current[id];

      if (!t) {
        continue;
      }

      let a = animRef.current.get(id);

      if (!a) {
        a = {
          x : t.x,
          y : t.y,
          w : t.w,
          h : t.h,
          vx: 0,
          vy: 0,
          vw: 0,
          vh: 0
        };
        animRef.current.set(id, a);
      }

      // A dragged panel snaps to the pointer-driven geometry (x always; y/w/h when
      // a 2D / resizable strategy provides them); the others spring around it.
      if (drag.current.panel === id) {
        a.x = drag.current.x;
        a.vx = 0;

        if (drag.current.y !== undefined) {
          a.y = drag.current.y;
          a.vy = 0;
        }

        if (drag.current.w !== undefined) {
          a.w = drag.current.w;
          a.vw = 0;
        }

        if (drag.current.h !== undefined) {
          a.h = drag.current.h;
          a.vh = 0;
        }

        apply(id);
        continue;
      }

      if (springAxes({
        anim  : a,
        target: t,
        dt,
        spring,
        snap  : draggingRef.current
      })) {
        moving = true;
      }

      apply(id);
    }

    rafRef.current = draggingRef.current || drag.current.panel !== null || moving ? requestAnimationFrame(frame) : null;
  }, [ids, apply, draggingRef, drag, spring]);

  const kick = useCallback(() => {
    if (rafRef.current === null) {
      lastTs.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  useLayoutEffect(() => {
    targetsRef.current = targets;

    if (!ready) {
      return;
    }

    if (!initDone.current) {
      for (const id of ids) {
        const t = targets[id]!;

        animRef.current.set(id, {
          x : t.x,
          y : t.y,
          w : t.w,
          h : t.h,
          vx: 0,
          vy: 0,
          vw: 0,
          vh: 0
        });
        apply(id);
      }

      initDone.current = true;
    } else {
      kick();
    }
  }, [ids, targets, ready, apply, kick]);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return {
    setPanelRef,
    kick
  };
}
