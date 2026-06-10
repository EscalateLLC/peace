import { describe, expect, it } from 'vitest';
import { DEFAULT_SPRING, SETTLE, springAxes, springStep } from './spring';
import type { AnimState, Target } from './types';

const animAt = (x: number): AnimState => ({
  x,
  y : 0,
  w : 0,
  h : 0,
  vx: 0,
  vy: 0,
  vw: 0,
  vh: 0
});

const targetAt = (x: number): Target => ({
  x,
  y: 0,
  w: 0,
  h: 0
});

describe('springStep', () => {
  const { stiff, damp } = DEFAULT_SPRING;

  it('converges to the target and then snaps to rest', () => {
    let pos = 0;
    let vel = 0;
    const target = 100;
    let moving = true;
    let iterations = 0;

    while (moving && iterations < 1000) {
      const r = springStep({
        pos,
        vel,
        target,
        dt: 1 / 60,
        stiff,
        damp
      });

      pos = r.pos;
      vel = r.vel;
      moving = r.moving;
      iterations++;
    }

    expect(moving).toBe(false);
    expect(pos).toBe(target); // exact snap on settle
    expect(vel).toBe(0);
    expect(iterations).toBeLessThan(1000);
  });

  it('reports moving while still far from target', () => {
    const r = springStep({
      pos   : 0,
      vel   : 0,
      target: 100,
      dt    : 1 / 60,
      stiff,
      damp
    });

    expect(r.moving).toBe(true);
    expect(r.pos).toBeGreaterThan(0);
  });

  it('snaps to rest when a tiny displacement keeps both pos and vel under the threshold', () => {
    const r = springStep({
      pos   : 100.02, // a 0.02px error against the stiff spring stays sub-threshold for one step
      vel   : 0,
      target: 100,
      dt    : 1 / 60,
      stiff,
      damp
    });

    expect(r.moving).toBe(false);
    expect(r.pos).toBe(100);
    expect(r.vel).toBe(0);
  });

  it('does not snap when a small displacement kicks the velocity past the threshold', () => {
    const r = springStep({
      pos   : 100 + SETTLE / 2,
      vel   : 0,
      target: 100,
      dt    : 1 / 60,
      stiff,
      damp
    });

    expect(r.moving).toBe(true); // stiff spring → |vel| exceeds SETTLE after the step
  });
});

describe('springAxes', () => {
  it('snaps every axis straight to target when snap is set (resize)', () => {
    const anim = animAt(0);

    const moving = springAxes({
      anim,
      target: targetAt(500),
      dt    : 1 / 60,
      spring: DEFAULT_SPRING,
      snap  : true
    });

    expect(moving).toBe(false);
    expect(anim.x).toBe(500);
    expect(anim.vx).toBe(0);
  });

  it('springs toward target (mutating anim) and reports moving', () => {
    const anim = animAt(0);

    const moving = springAxes({
      anim,
      target: targetAt(500),
      dt    : 1 / 60,
      spring: DEFAULT_SPRING,
      snap  : false
    });

    expect(moving).toBe(true);
    expect(anim.x).toBeGreaterThan(0);
    expect(anim.x).toBeLessThan(500);
  });
});
