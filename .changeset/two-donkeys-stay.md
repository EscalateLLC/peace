---
---

refactor(workspace): extract `useDiagramView`, `useDeckLayout`, and
`useDiagramPanelState` from `MermaidDiagram` / `DeckWorkspace`. No behavior
change — clears the `max-statements` lint warnings and isolates the view,
layout, and diagram-panel concerns. No release note.
