---
'@peace/router': minor
'@peace/agent': minor
---

Expectancy monitor — peace gets tapped when the room is waiting for it.

peace is a reactive observer (speaks when spoken to). A live test exposed the missing half: it answered a question, the user asked a follow-up ~13s later without re-saying "peace", and it landed just past the 12s follow-up window → silence. The conversation hadn't ended; a timer had.

The fix keeps the reactive model and adds the helper that watches for an *expected* reply (decision D14):

- **Window widened** 12s → 30s (`followUpWindowMs`).
- **New `prompted` nomination lane** fed by a heuristic expectancy monitor, scoped to conversations peace is recently part of (never human-to-human):
  - wires the previously-unused **turn-yield** detector (H2) — a hand-off like "…so, thoughts?" taps peace;
  - adds a **"unanswered turn + quiet floor"** cue (`evaluateWaitingExpectancy`) — the breach case — that nudges peace ~a couple seconds after a human turn goes unanswered.
- It **taps, never nags**: cooldown-guarded, not budget-capped (it's responding to apparent demand), and goes through the same gates + the agent's `stay_silent`, so it can't talk over anyone or force a reply.

Barge-in stays content-aware (committed words, not raw voice activity). An LLM "vibe" assessor is designed to plug into the same `prompted` lane later; not built yet.
