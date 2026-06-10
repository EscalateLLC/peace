---
"@peace/web": minor
---

Workflow diagram canvas + reliable node interactions

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
