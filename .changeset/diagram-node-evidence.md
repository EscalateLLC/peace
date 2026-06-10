---
"@peace/web": patch
---

Workspace diagram: node↔evidence cross-linking and in-place editing

Mermaid flowchart nodes that carry evidence are now interactive. Hovering a node lights its source transcript segments (and lit segments light their nodes back — bidirectional cross-link); clicking drills into a node-detail modal showing the justifying turns as ChatBubbles, with actions to highlight the evidence in the transcript or edit the diagram. The modal hosts a Mermaid-source editor that saves a new diagram version through the workspace adapter. Node listeners are attached natively (React `onClick` is unreliable on `dangerouslySetInnerHTML` SVG) and read live callbacks via a ref so they only re-attach on a fresh render. The diagram container also marks itself `data-intent="control"` so the panel's drag/zoom gesture bails on diagram pointer-downs. The deck's resize measurement now bails when dimensions are unchanged, avoiding a redundant state update.
