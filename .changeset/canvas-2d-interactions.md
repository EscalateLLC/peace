---
'@peace/web': minor
---

Make the 2-D workspace canvas feel intuitive. A 1-D / 2-D dimensionality toggle now sits
in the workspace header (persisted per browser). Reflow runs on react-grid-layout's native
compaction (Columns / Stack modes) so neighbours displace out of the way live as you drag,
and a full 8-point resize border appears on panel hover. Double-tapping a panel header
grows it into adjacent free space — or full-screens it when it's hemmed in — and
double-tapping again restores. Any panel nudged out of bounds is auto-corrected back into
the grid.
