---
'@peace/web': minor
---

Add an agent-control lock to the workflow diagram.

While locked, the diagram is read-only — user pan, wheel-zoom, and node-drill are
suspended, the zoom controls disable, and a "Locked" badge shows (click it to
unlock). Toggle it from the diagram controls; the conversational agent will drive
the same flag for agent-led repositioning, riding the existing busy/loading mask.
Also fixes the overlay controls (zoom/fit) losing their click when the press was
mistaken for the start of a pan.
