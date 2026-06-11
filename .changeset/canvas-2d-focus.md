---
'@peace/web': minor
---

Double-tap a panel's header in the 2-D canvas to maximize it to a focus overlay — the
workflow panel opens with its full diagram (pan/zoom) and flow tree; double-tap again,
press Esc, or click the backdrop to restore. The focus is ephemeral (not persisted) and
reuses the same evidence-linked panel body.

Built on a new pointer-based double-tap detector (`useDoubleTap` in the kit) that is
drift-tolerant and time-windowed, so it layers safely over react-grid-layout's drag
handle: a drag (any move past the threshold) never reads as a tap, and a double-tap
never moves the panel.
