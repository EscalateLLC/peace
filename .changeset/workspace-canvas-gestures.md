---
"@peace/web": patch
---

Workspace canvas: drag-reorder, seam-resize, in-place expand

The meeting workspace panels are now spring-positioned (via the kit's `useSpringLayout`/`useResize`/intent gesture) rather than a fixed grid: press-drag a panel to reorder it, drag a gutter seam to resize, and tap a panel surface to expand it in place (with a backdrop). Measurement happens on a callback ref so the deck — which only mounts after the meeting data loads — is sized correctly.
