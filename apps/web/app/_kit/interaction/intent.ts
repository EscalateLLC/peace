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
 *   1. an explicit `data-intent` on (or inside) the nearest control wins — e.g.
 *      `<button data-intent="content">` is `content`, an author override, so it
 *      drags/zooms with its surface instead of being treated as an action control;
 *   2. otherwise a genuine control → `control` (even inside a content region);
 *   3. otherwise the nearest `[data-intent]` ancestor's value (`content` / `surface`);
 *   4. otherwise `surface` (the inherited default).
 */
export function resolveIntent (opts: { target: Element | null; controlSelector?: string }): Intent {
  const { target } = opts;
  const controlSelector = opts.controlSelector ?? DEFAULT_CONTROL_SELECTOR;

  if (!target) {
    return 'surface';
  }

  const control = target.closest(controlSelector);
  const marked = target.closest('[data-intent]');

  // An explicit data-intent wins when it sits on (or inside) the nearest control;
  // a genuine control with no data-intent of its own stays control.
  if (marked && (!control || control.contains(marked))) {
    return asIntent(marked.getAttribute('data-intent')) ?? 'surface';
  }

  return control ? 'control' : 'surface';
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
