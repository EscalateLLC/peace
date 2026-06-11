---
'@peace/web': patch
---

Scope the workspace canvas to a clean 1-D layout: panels move/reorder and resize
horizontally within a single full-height row. Drag-to-reorder is responsive whichever
panel you grab — the insertion point is computed against the *closed-up* neighbours,
so a small drag past a neighbour swaps them, and the row packs contiguously in order.
Resize is a **split**: growing a panel shrinks its neighbour across that boundary by
the same amount, so the row always stays full (never any free space). The free 2-D
layout will follow behind a flag.
