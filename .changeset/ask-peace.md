---
'@peace/web': minor
---

Add "Ask peace" to the diagram-node drill-down.

A node drill now carries an Ask peace box: type a question about the step and the
conversational agent answers over the meeting transcript — a new
`POST /api/meetings/[id]/ask` route calls `draftResponse`, and the reply (or a
"stayed silent") renders inline. Requires `ANTHROPIC_API_KEY`; the route returns
503 without it.
