---
'@peace/web': minor
---

Add a fluid 2-D canvas mode for the workspace, behind a flag (`NEXT_PUBLIC_CANVAS_2D`,
or a per-browser `peace:canvas2d` toggle). Panels become freely placed and sized boxes
on react-grid-layout — drag to move (colliding panels displace), resize from any edge
or corner. The canvas is fixed to its parent and never scrolls: rows are sized so the
grid exactly fills the deck.

A controls bar offers configurable reflow (Free / Stack / Pack) and atomic layout
presets (Even / Focus / Rows) — the reset + transform mechanism — and the saved layout
is validated on load (every panel present exactly once, else reset to Even), so the
canvas can never get stuck in a busted state. The 1-D layout remains the default; the
2-D deck reuses the same evidence-linked panel bodies and persists per browser.

Adds the `react-grid-layout` dependency (exact-pinned, pure JS with no install scripts,
ships its own types).
