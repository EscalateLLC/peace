import type { Theme } from './types';

/**
 * JS-readable "feel" values that mirror the CSS motion tokens, for animation code
 * that needs numbers rather than `getComputedStyle` (e.g. the kit's rAF spring).
 * Keep in sync with each theme's `--peace-spring-*` / `--peace-motion-scale`.
 */
export interface ThemeFeel {
  springStiff: number;
  springDamp: number;
  motionScale: number;
}

export const FEEL: Record<Theme, ThemeFeel> = {
  tron: {
    springStiff: 260,
    springDamp : 30,
    motionScale: 1
  },
  cloud: {
    springStiff: 190,
    springDamp : 26,
    motionScale: 1
  },
  confluence: {
    springStiff: 320,
    springDamp : 40,
    motionScale: 0.7
  },
  dreadnought: {
    springStiff: 240,
    springDamp : 42,
    motionScale: 0.8
  },
  platinum: {
    springStiff: 220,
    springDamp : 30,
    motionScale: 1
  },
  royalty: {
    springStiff: 200,
    springDamp : 28,
    motionScale: 0.9
  },
  bubble: {
    springStiff: 340,
    springDamp : 15,
    motionScale: 1.1
  }
};
