/**
 * Intent inheritance — what a pointer-down/hover on an element *means*, without
 * a fragile blocklist. An element inherits its surface's behavior by default;
 * the nearest explicit `data-intent` ancestor overrides it, and genuine
 * interactive controls always opt out. This is the model that lets a rich panel
 * stay approachable: tap empty space to zoom the panel, hover a message to zoom
 * *it* for legibility, click a button to do its thing — each with its own
 * cursor + highlight.
 */

import type { Cursor, Intent, Phase } from './types';

/** Genuinely-interactive elements that always handle their own click. */
export const DEFAULT_CONTROL_SELECTOR = 'button, a, input, textarea, select, [data-control], [data-intent="control"]';

const INTENTS: readonly Intent[] = ['surface', 'content', 'control'];

function asIntent (value: string | null): Intent | null {
  return INTENTS.includes(value as Intent) ? value as Intent : null;
}

/**
 * Resolve the intent for a pointer target:
 *   1. a genuine control (or `[data-intent="control"]`) → `control`;
 *   2. otherwise the nearest `[data-intent]` ancestor's value (`content` / `surface`);
 *   3. otherwise `surface` (the inherited default).
 */
export function resolveIntent (opts: { target: Element | null; controlSelector?: string }): Intent {
  const { target } = opts;
  const controlSelector = opts.controlSelector ?? DEFAULT_CONTROL_SELECTOR;

  if (!target) {
    return 'surface';
  }

  if (target.closest(controlSelector)) {
    return 'control';
  }

  const marked = target.closest('[data-intent]');

  return marked ? asIntent(marked.getAttribute('data-intent')) ?? 'surface' : 'surface';
}

/**
 * The cursor that previews the action: pressing/dragging → grabbing; a control →
 * pointer; content → zoom-in (zoom the element); surface → zoom-in to maximize
 * the panel, or zoom-out when it's already expanded.
 */
export function deriveCursor (opts: { intent: Intent; phase: Phase; expanded: boolean }): Cursor {
  const { intent, phase, expanded } = opts;

  if (phase === 'press' || phase === 'drag') {
    return 'grabbing';
  }

  if (intent === 'control') {
    return 'pointer';
  }

  if (intent === 'content') {
    return 'zoom-in';
  }

  if (intent === 'surface') {
    return expanded ? 'zoom-out' : 'zoom-in';
  }

  return 'default';
}
