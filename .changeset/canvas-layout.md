---
'@peace/web': minor
---

Add a grid-snap canvas layout for the workspace — move, reorder, and resize panels.

Panels are boxes on a responsive snap grid. Drag a panel's frame to move it and the
others **reflow + compact** around it into a tidy, gapless arrangement (drag-to-
rearrange, like a dashboard). Drag any of the 8 edge/corner handles to **resize**,
snapping to whole cells live. The arrangement persists per browser via `localStorage`
behind a `layoutStore` seam the settings system later swaps for per-user persistence.

Replaces the horizontal slot layout (`useDeckLayout` → `useCanvasLayout`). The kit's
spring + gesture were already 2-D-ready; `DragState` gains optional `w`/`h` so a
resized panel bypasses the spring render-free, mirroring the existing optional `y`.
