# peace kit

An **internal, private** React component library for the peace workspace — the
intent-compatible controls + the interaction engine that powers the canvas. No
public API; iterate freely.

## What's here

- **`interaction/`** — the renderer-agnostic engine: `IntentSurface` /
  `useIntentGesture` (the intent model), the rAF spring, geometry, and the
  expand/resize hooks. Pure logic is unit-tested. Treats panel *content* as an
  opaque child — so it never assumes a renderer (DOM today; a `<canvas>` diagram
  layer could slot into one panel later without touching the engine).
- **`controls/`** — intent-compatible controls (e.g. `ChatBubble`). Each control
  owns its *structure + behavior + intent contract* and ships an opinionated —
  but fully overrideable — default look.
- **`theme.css`** — the opinionated default theme (`--pk-*` tokens + font vars).
- **`cx.ts`** — a tiny className joiner.

## Styling model — opinionated default, transparent, overrideable

The default look helps a consumer see the *intended feel* on drop-in. It is a
suggestion, not a contract:

- **Transparent.** Controls render stable, namespaced classes (`.pk-*`) and
  `data-part` hooks (e.g. `data-part="bubble|avatar|text"`) — visible in the DOM
  and targetable. No hashed CSS-Modules, no runtime CSS-in-JS.
- **Overrideable at every level:**
  1. **Retheme** — set `--pk-*` variables on `:root` or any ancestor.
  2. **Restyle** — write CSS against the `.pk-*` classes / `data-part`s.
  3. **Merge** — pass `className` / `style` (merged, not replaced).
  4. **Opt out** — don't import `theme.css`; style from scratch.
- **Customizable structure** — props like `variant` / `density`, and an
  `asChild`-style escape hatch where it earns its keep.

## Intent contract

A control is *intent-compatible* when it declares its `data-intent` so it
composes correctly inside an `IntentSurface`:

- `data-intent="content"` — hover highlights + **zooms the element for
  legibility**; never maximizes the surface; may carry its own click.
- genuine controls (`button`, `[data-intent="control"]`, …) — own click,
  `pointer` cursor, no zoom/drag.
- unmarked — inherits `surface` (tap max/min, drag reorder).

`resolveIntent` / `deriveCursor` in `interaction/intent.ts` encode this.

## Usage

```tsx
import './_kit/theme.css';                 // once, at the app root (optional)
import { ChatBubble } from '../_kit';

<ChatBubble speaker="Dana" time="02:14" density="compact" onActivate={...}>
  Let's scope the beta to live transcript only.
</ChatBubble>
```

## Promotion plan → private `@peace/ui-kit`

Lives in `apps/web/app/_kit/` **now** (in-app, private, iterate freely). The
folder mirrors a package `src/`, so promotion is a move + wiring:

- **Promote when** the control API has settled · a second consumer beyond the
  deck appears · or the real `WorkspaceShell` wants the controls.
- **Mechanics:** move `_kit/*` → `packages/ui-kit/src/*`; add `package.json`
  (`@peace/ui-kit`, `private: true`, `exports: { ".": "./src/index.ts" }`,
  `react`/`react-dom` peerDeps via `catalog:`, exact pins), `tsconfig.json`
  (extends `@peace/config-presets/tsconfig.react.json`), `vitest.config.ts`
  (shared preset); add `packages/ui-kit/src` to the `@source` list in
  `apps/web/app/globals.css`; swap consumer imports to `@peace/ui-kit`.
- **Invariants that keep promotion cheap:** no app-specific imports here (generic
  props only — no mock data, no `next/*`); `theme.css` self-contained; the engine
  stays dependency-free.
