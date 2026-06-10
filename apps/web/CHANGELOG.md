# @peace/web

## 0.2.0

### Minor Changes

- 4dfcaa1: Add @peace/design — the runtime theming system

  A new `@peace/design` package: the `--peace-*` design-token contract (SCSS theme maps → CSS custom properties), seven runtime-swappable themes (tron, cloud, confluence, dreadnought, platinum, royalty, bubble), each with a distinct **interaction language** — hover glow + border, hard focus border, themed move/lift — plus the `corner()` keystone (runtime bevel↔radius↔square) and an SSR-safe no-flash `ThemeProvider` / `useTheme` / `ThemeToggle`. The kit controls consume the token contract (via a `--pk-*` → `--peace-*` alias), so they re-skin with the active theme. `/mockups/kit` becomes a design-system playground (theme · typeface · density · motion + a full control/state gallery).

- bd6453f: Workflow diagram canvas + reliable node interactions

  The workflow panel is now a pan/zoom diagram canvas. The Mermaid diagram renders centred
  on a themed dotted grid (it re-skins per theme) inside a framed, inset canvas. Expanded,
  it behaves like a real diagram surface — drag to pan, mousewheel to zoom (about the
  centre), and ＋ / − / fit controls; collapsed, tapping empty space expands the panel and
  tapping a node drills its evidence.

  Node clicks are now reliable: the drill is a document-level pointerdown→pointerup tap
  keyed on the node (tolerant of a few px of click-drift and immune to Mermaid re-rendering
  its SVG out of band), so it no longer takes two or three tries.

  The panel's "inset margin" is a drag handle that takes priority over content. An explicit
  `data-intent` now wins over the implicit "buttons are controls" rule, so cards (and
  bubbles) sitting in the frame band drag the panel — and show the grab cursor — while still
  drilling in the interior.

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- e517b6d: Realtime workspace transport (realtime/04 + workspace/02, D6) and defensive meeting lifecycle (realtime/05, D10).

  - New `@peace/transport`: `createDeltaServer` — WS fan-out of `WorkspaceDelta`s (`ws://localhost:8787`, `ws` exact-pinned), per-meeting seq, heartbeat, subscribe protocol (schemas shared via `@peace/core`). SQLite stays the source of truth; the socket is delivery only.
  - `WorkspaceDataAdapter` gains optional `subscribe()`; `WorkspaceShell` applies pushed deltas when available (segments appear in ~instantly instead of the 2.5s poll) with a quiet "live: delayed" hint when degraded. The web adapter owns the WS client, reconnect with jittered backoff, and a polling fallback that synthesizes the same deltas — total transport failure is exactly the old UX.
  - The bot hosts the delta server and publishes segments (via the session's new `onDelta` hook), meeting status transitions, and artifacts. `replay-live <file> --ws --pace <ms>` live-streams a fixture into the workspace — demo and transport harness in one.
  - Defensive lifecycle (restore-as-active policy): startup recovery sweep restores meetings orphaned by a process death (transcript-bearing → active again with a channel notice; empty husks → failed; unreachable channel → complete), graceful SIGINT/SIGTERM shutdown announces, leaves voice cleanly and pauses meetings for the next boot, failed joins roll their meeting back instead of leaving zombie 'live' rows, and stop/artifact commands restore from the DB when process memory forgot the meeting. Voice connections get a 5s reconnect grace on mid-call drops.

- e6dd144: Theme the product: design-system root + themed home

  Wire `@peace/design` into the product root (`app/layout.tsx`): load `@peace/design/styles` + the core fonts (Hanken / JetBrains Mono / Fraunces) + the kit `--pk-*` alias, wrap the tree in `ThemeProvider`, and apply the themed `.peace-root` to `<body>`. Add a `color-scheme` token (dark/light per theme) so native scrollbars + form controls match. Rebuild the home / meeting list on `--peace-*` tokens with a theme `<select>` switcher — readable across light and dark themes, with the per-theme interaction recipe on the meeting cards. Mockups stay on Tailwind.

- c95fd25: Rebuild the meeting workspace on the design system (themed, live data)

  Replace the Tailwind `@peace/ui` `WorkspaceShell` at `/meeting/[id]` with a new intent-canvas workspace built on `@peace/design` tokens + the kit. Three themed panels over live meeting data: the transcript as kit `ChatBubble`s, the artifacts as decision/action/question/key-point cards (with evidence chips + uncertainty), and the Mermaid diagram re-rendered in mermaid's light/dark theme to match the active peace theme. Evidence cross-linking lights source segments on hover and drills into a themed modal (kit `ZoomStack`) showing the transcript turns that justify each item; tap a panel surface to expand. The fetch + live-subscribe + delta logic is extracted into a reusable `useWorkspace` hook (`applyWorkspaceDelta` is now exported from `@peace/ui`). The whole surface — including the diagram — re-skins with the theme switcher.

- 0f6d937: Split workflow panel: diagram canvas + evidence-linked flow tree

  The workflow panel is now a split — the pan/zoom diagram canvas up top and a
  navigable flow outline below, parsed from the Mermaid source. Hovering a tree row
  cross-links the diagram node and its transcript evidence (and lights the row);
  clicking drills the same evidence modal. The node drill now also lists the linked
  artifacts — the action items / decisions that cite the node's evidence.

  Expanded, the panel splits horizontally (diagram left, flow outline right) and
  either side minimises to a rail — the whole header bar is the toggle — transitioning
  fluidly. The diagram auto-centres on resize and masks the reposition with a brief
  loading state so it never snaps (the same hook a locked, agent-driven diagram will
  use). The Mermaid render and the scrollbars are now themed to the peace tokens, and
  panel headers get a subtle elevation for layout legibility.

  Adds a `data-no-frame` opt-out to the kit's intent gesture so dense interactive
  lists (the flow outline) stay clickable to their edge instead of becoming drag.

### Patch Changes

- 4eff15a: Workspace diagram: node↔evidence cross-linking and in-place editing

  Mermaid flowchart nodes that carry evidence are now interactive. Hovering a node lights its source transcript segments (and lit segments light their nodes back — bidirectional cross-link); clicking drills into a node-detail modal showing the justifying turns as ChatBubbles, with actions to highlight the evidence in the transcript or edit the diagram. The modal hosts a Mermaid-source editor that saves a new diagram version through the workspace adapter. Node listeners are attached natively (React `onClick` is unreliable on `dangerouslySetInnerHTML` SVG) and read live callbacks via a ref so they only re-attach on a fresh render. The diagram container also marks itself `data-intent="control"` so the panel's drag/zoom gesture bails on diagram pointer-downs. The deck's resize measurement now bails when dimensions are unchanged, avoiding a redundant state update.

- 0302010: Workspace canvas: drag-reorder, seam-resize, in-place expand

  The meeting workspace panels are now spring-positioned (via the kit's `useSpringLayout`/`useResize`/intent gesture) rather than a fixed grid: press-drag a panel to reorder it, drag a gutter seam to resize, and tap a panel surface to expand it in place (with a backdrop). Measurement happens on a callback ref so the deck — which only mounts after the meeting data loads — is sized correctly.

- Updated dependencies [4dfcaa1]
- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [e6dd144]
- Updated dependencies [c95fd25]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/design@0.2.0
  - @peace/core@0.2.0
  - @peace/pipeline@0.2.0
  - @peace/db@0.2.0
  - @peace/ui@0.2.0
  - @peace/ai@0.2.0
  - @peace/logger@0.2.0
