/**
 * Shared types for the deck interaction engine. Generalized over a string `Id`
 * so the spring/geometry/gesture engine is reusable beyond the deck's 3 panels.
 */

export type Id = string;

/** A panel's animated geometry target (deck-relative px). */
export interface Target { x: number; y: number; w: number; h: number }

/** A panel's live animated value + per-axis velocity. */
export interface AnimState { x: number; y: number; w: number; h: number; vx: number; vy: number; vw: number; vh: number }

/**
 * The panel currently being dragged + its pointer-driven position (shared
 * spring↔gesture). `x` always tracks the pointer; `y` is optional so a 2D
 * layout strategy can drag freely in both axes (the horizontal row leaves it
 * undefined, so y keeps springing to its slot).
 */
export interface DragState { panel: Id | null; x: number; y?: number }

export type Axis = 'x' | 'y' | 'w' | 'h';

export const AXES: readonly Axis[] = ['x', 'y', 'w', 'h'];

/**
 * What the pointer is over, by intent inheritance:
 * - `surface` — empty/padding/grip: panel-level tap (max/min) + press-drag (reorder).
 * - `content` — display content (a message, a card): hover zooms *the element* for
 *   visibility; does NOT maximize the panel.
 * - `control` — a genuine interactive control: handles its own click, no zoom/drag.
 */
export type Intent = 'surface' | 'content' | 'control';

/** Gesture phase, used (with intent) to derive the cursor. */
export type Phase = 'idle' | 'press' | 'drag';

export type Cursor = 'default' | 'pointer' | 'zoom-in' | 'zoom-out' | 'grab' | 'grabbing';
