import { describe, expect, it } from 'vitest';
import { buildTargets, clampSeamDelta, computeSlots, focalRatios, nearestSlot, reorder } from './geometry';

describe('computeSlots', () => {
  it('splits available width by ratios and offsets each slot by gaps', () => {
    const { aw, sw, sx, h } = computeSlots({
      width : 1000,
      height: 800,
      ratios: [0.25, 0.5, 0.25],
      pad   : 12,
      gap   : 10
    });

    // available = 1000 - 2*12 - 2*10 = 956
    expect(aw).toBe(956);
    expect(sw).toEqual([239, 478, 239]);
    expect(sx[0]).toBe(12);
    expect(sx[1]).toBe(12 + 239 + 10);
    expect(sx[2]).toBe(12 + 239 + 10 + 478 + 10);
    expect(h).toBe(776);
  });

  it('never produces negative dimensions when the container is tiny', () => {
    const { aw, h } = computeSlots({
      width : 0,
      height: 0,
      ratios: [0.25, 0.5, 0.25],
      pad   : 12,
      gap   : 10
    });

    expect(aw).toBe(0);
    expect(h).toBe(0);
  });
});

describe('focalRatios', () => {
  it('gives the focal slot the focal share and splits the rest evenly', () => {
    expect(focalRatios({
      focal     : 1,
      focalRatio: 0.5
    })).toEqual([0.25, 0.5, 0.25]);
    expect(focalRatios({
      focal     : 0,
      focalRatio: 0.5
    })).toEqual([0.5, 0.25, 0.25]);
    expect(focalRatios({
      focal     : 2,
      focalRatio: 0.6
    })).toEqual([0.2, 0.2, 0.6]);
  });
});

describe('clampSeamDelta', () => {
  it('passes an in-range delta through', () => {
    expect(clampSeamDelta({
      delta   : 0.05,
      a0      : 0.4,
      b0      : 0.4,
      minRatio: 0.16
    })).toBe(0.05);
  });

  it('clamps so neither side drops below minRatio', () => {
    // pushing left too far: a0 would go below min
    expect(clampSeamDelta({
      delta   : -0.5,
      a0      : 0.3,
      b0      : 0.3,
      minRatio: 0.16
    })).toBeCloseTo(0.16 - 0.3);

    // pushing right too far: b0 would go below min
    expect(clampSeamDelta({
      delta   : 0.5,
      a0      : 0.3,
      b0      : 0.3,
      minRatio: 0.16
    })).toBeCloseTo(0.3 - 0.16);
  });
});

describe('nearestSlot', () => {
  const sx = [12, 261, 749];
  const sw = [239, 478, 239];

  it('picks the slot whose centre is closest to the pointer', () => {
    expect(nearestSlot({
      px: 12 + 239 / 2,
      sx,
      sw
    })).toBe(0);
    expect(nearestSlot({
      px: 261 + 478 / 2,
      sx,
      sw
    })).toBe(1);
    expect(nearestSlot({
      px: 749 + 239 / 2,
      sx,
      sw
    })).toBe(2);
  });

  it('clamps past-the-end pointers to the last slot', () => {
    expect(nearestSlot({
      px: 5000,
      sx,
      sw
    })).toBe(2);
    expect(nearestSlot({
      px: -5000,
      sx,
      sw
    })).toBe(0);
  });
});

describe('reorder', () => {
  it('moves an id into a new slot immutably', () => {
    expect(reorder({
      order: ['a', 'b', 'c'],
      id   : 'a',
      slot : 2
    })).toEqual(['b', 'c', 'a']);
    expect(reorder({
      order: ['a', 'b', 'c'],
      id   : 'c',
      slot : 0
    })).toEqual(['c', 'a', 'b']);
    expect(reorder({
      order: ['a', 'b', 'c'],
      id   : 'b',
      slot : 0
    })).toEqual(['b', 'a', 'c']);
  });

  it('returns the same array reference when already in that slot', () => {
    const order = ['a', 'b', 'c'];

    expect(reorder({
      order,
      id  : 'b',
      slot: 1
    })).toBe(order);
  });
});

describe('buildTargets', () => {
  const slots = computeSlots({
    width : 1000,
    height: 800,
    ratios: [0.25, 0.5, 0.25],
    pad   : 12,
    gap   : 10
  });

  it('uses slot geometry for each panel in order', () => {
    const t = buildTargets({
      ids  : ['a', 'b', 'c'],
      order: ['a', 'b', 'c'],
      slots,
      pad  : 12
    });

    expect(t.a).toEqual({
      x: slots.sx[0],
      y: 12,
      w: slots.sw[0],
      h: slots.h
    });
    expect(t.b!.x).toBe(slots.sx[1]);
  });

  it('lets expandGeom override a panel with a custom rect', () => {
    const t = buildTargets({
      ids       : ['a', 'b', 'c'],
      order     : ['a', 'b', 'c'],
      slots,
      pad       : 12,
      expandGeom: id => (id === 'b' ? {
        x: 1,
        y: 2,
        w: 3,
        h: 4
      } : null)
    });

    expect(t.b).toEqual({
      x: 1,
      y: 2,
      w: 3,
      h: 4
    });
    expect(t.a!.x).toBe(slots.sx[0]); // others fall back to slot geometry
  });
});
