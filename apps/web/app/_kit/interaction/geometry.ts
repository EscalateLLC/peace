/**
 * Pure layout geometry for the deck — slot widths/offsets, ratio helpers, the
 * resize clamp, nearest-slot hit-testing, immutable reorder, and per-panel
 * target assembly. No DOM, no React — fully unit-testable.
 */

import type { Id, Target } from './types';

export interface Slots {

  /** available width = container width minus padding + gaps. */
  aw: number;

  /** slot widths (one per slot). */
  sw: number[];

  /** slot left offsets (deck-relative px). */
  sx: number[];

  /** panel height (container height minus padding). */
  h: number;
}

/** Slot widths + x offsets for a row of 3 panels from per-slot width ratios. */
export function computeSlots (opts: { width: number; height: number; ratios: number[]; pad: number; gap: number }): Slots {
  const { width, height, ratios, pad, gap } = opts;
  const aw = Math.max(0, width - 2 * pad - 2 * gap);
  const sw = ratios.map(r => aw * r);
  const sx = [pad, pad + sw[0]! + gap, pad + sw[0]! + gap + sw[1]! + gap];
  const h = Math.max(0, height - 2 * pad);

  return {
    aw,
    sw,
    sx,
    h
  };
}

/** Default width ratios with the focal slot widest. */
export function focalRatios (opts: { focal: number; focalRatio: number }): number[] {
  const { focal, focalRatio } = opts;
  const rest = (1 - focalRatio) / 2;

  return [0, 1, 2].map(i => (i === focal ? focalRatio : rest));
}

/** Clamp a gutter-drag delta so neither adjacent slot drops below `minRatio`. */
export function clampSeamDelta (opts: { delta: number; a0: number; b0: number; minRatio: number }): number {
  const { delta, a0, b0, minRatio } = opts;

  return Math.max(minRatio - a0, Math.min(b0 - minRatio, delta));
}

/** Index of the slot whose centre is nearest the pointer x (deck-relative). */
export function nearestSlot (opts: { px: number; sx: number[]; sw: number[] }): number {
  const { px, sx, sw } = opts;
  let hover = 0;
  let best = Infinity;

  for (let s = 0; s < sx.length; s++) {
    const dist = Math.abs(px - (sx[s]! + sw[s]! / 2));

    if (dist < best) {
      best = dist;
      hover = s;
    }
  }

  return hover;
}

/** Move `id` into `slot`, immutably. Returns the same array if already there. */
export function reorder (opts: { order: Id[]; id: Id; slot: number }): Id[] {
  const { order, id, slot } = opts;

  if (order.indexOf(id) === slot) {
    return order;
  }

  const next = order.filter(x => x !== id);

  next.splice(slot, 0, id);

  return next;
}

/**
 * Per-panel target geometry. `expandGeom(id)` injects the app-specific expanded
 * rect (or null to use the panel's slot geometry), keeping this data-agnostic.
 */
export function buildTargets (opts: {
  ids: readonly Id[];
  order: Id[];
  slots: Slots;
  pad: number;
  expandGeom?: (id: Id, slot: number) => Target | null;
}): Record<Id, Target> {
  const { ids, order, slots, pad, expandGeom } = opts;
  const out: Record<Id, Target> = {};

  for (const id of ids) {
    const slot = order.indexOf(id);

    out[id] = expandGeom?.(id, slot) ?? {
      x: slots.sx[slot]!,
      y: pad,
      w: slots.sw[slot]!,
      h: slots.h
    };
  }

  return out;
}
