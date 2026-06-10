---
"@peace/web": minor
---

Split workflow panel: diagram canvas + evidence-linked flow tree

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
