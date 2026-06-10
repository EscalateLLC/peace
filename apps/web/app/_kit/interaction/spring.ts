/**
 * Pure spring integrator (semi-implicit Euler) for one scalar axis. The rAF
 * loop in useSpringLayout calls this per panel per axis. Tuned for a snappy,
 * lightly-overshooting iOS feel; snaps to target inside the settle threshold.
 */

import { AXES, type AnimState, type Target } from './types';

export interface Spring { stiff: number; damp: number }

export const DEFAULT_SPRING: Spring = {
  stiff: 260,
  damp : 30
};

/** px/velocity below which an axis is considered at rest and snapped. */
export const SETTLE = 0.3;

export function springStep (opts: { pos: number; vel: number; target: number; dt: number; stiff: number; damp: number }): { pos: number; vel: number; moving: boolean } {
  const { pos, vel, target, dt, stiff, damp } = opts;
  const v = vel + (-stiff * (pos - target) - damp * vel) * dt;
  const p = pos + v * dt;

  if (Math.abs(p - target) > SETTLE || Math.abs(v) > SETTLE) {
    return {
      pos   : p,
      vel   : v,
      moving: true
    };
  }

  return {
    pos   : target,
    vel   : 0,
    moving: false
  };
}

/**
 * Step all four axes of a panel's AnimState toward its Target (mutating `anim`).
 * `snap` (used while resizing) sets each axis straight to target. Returns whether
 * any axis is still moving.
 */
export function springAxes (opts: { anim: AnimState; target: Target; dt: number; spring: Spring; snap: boolean }): boolean {
  const { anim, target, dt, spring, snap } = opts;
  let moving = false;

  for (const ax of AXES) {
    const v = `v${ax}` as const;

    if (snap) {
      anim[ax] = target[ax];
      anim[v] = 0;
    } else {
      const r = springStep({
        pos   : anim[ax],
        vel   : anim[v],
        target: target[ax],
        dt,
        stiff : spring.stiff,
        damp  : spring.damp
      });

      anim[ax] = r.pos;
      anim[v] = r.vel;

      if (r.moving) {
        moving = true;
      }
    }
  }

  return moving;
}
