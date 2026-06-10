# @peace/agent

## 0.2.0

### Minor Changes

- cc8e2fa: Expectancy monitor — peace gets tapped when the room is waiting for it.

  peace is a reactive observer (speaks when spoken to). A live test exposed the missing half: it answered a question, the user asked a follow-up ~13s later without re-saying "peace", and it landed just past the 12s follow-up window → silence. The conversation hadn't ended; a timer had.

  The fix keeps the reactive model and adds the helper that watches for an _expected_ reply (decision D14):

  - **Window widened** 12s → 30s (`followUpWindowMs`).
  - **New `prompted` nomination lane** fed by a heuristic expectancy monitor, scoped to conversations peace is recently part of (never human-to-human):
    - wires the previously-unused **turn-yield** detector (H2) — a hand-off like "…so, thoughts?" taps peace;
    - adds a **"unanswered turn + quiet floor"** cue (`evaluateWaitingExpectancy`) — the breach case — that nudges peace ~a couple seconds after a human turn goes unanswered.
  - It **taps, never nags**: cooldown-guarded, not budget-capped (it's responding to apparent demand), and goes through the same gates + the agent's `stay_silent`, so it can't talk over anyone or force a reply.

  Barge-in stays content-aware (committed words, not raw voice activity). An LLM "vibe" assessor is designed to plug into the same `prompted` lane later; not built yet.

- 5654640: The bot now honors "leave the call" and knows when it's on its backup voice.

  Two field-reported failures, both rooted in the conversational agent being unaware of its own situation:

  - **It wouldn't leave when asked.** Spoken leave requests ("leave the call", "you can head out", "get out") were only intercepted when prefixed by the wake word _and_ phrased as `stop|leave|end`; everything else fell through to the agent, which had no leave capability and hallucinated _"I can't physically exit the call."_ Now:
    - The agent has a **`leave_call` tool** and is told in its prompt that it CAN leave — so any natural phrasing works and it never falsely refuses. A `leave_call` decision is honored outside the router (speaks an optional goodbye, then disconnects + finalizes).
    - A **high-precision deterministic fast-path** (`matchLeaveCommand`) still catches explicit commands instantly (no LLM round-trip): wake-prefixed ("peace, head out") or a 2nd-person directive ("you can leave", "can you disconnect"). It deliberately does NOT fire on a human announcing their own departure ("I have to leave the call") or incidental verbs ("did you leave the door open").
  - **It didn't tell anyone it had switched to the backup voice.** The ElevenLabs→Deepgram fallback only lit up the workspace banner. Now the switch is also **announced once in the Discord channel**, and the agent is given an **operational note** ("you're on your backup voice…") so it can explain accurately if a participant asks why it sounds different.
  - **`agent.responded` now logs a short `preview`** of what was said (first ~140 chars), so the logs can be correlated to what was actually heard — previously only `chars` (length) was recorded, which made debugging "what did it say?" impossible.

- cc8e2fa: The participation router (router/06, decision D1 → custom zero-dep engine): peace now decides _when_ to speak, not just _what_.

  - **New `@peace/router`** — `createParticipationRouter`: a background watcher that folds the conversation into state and nominates candidates (explicit address, **follow-up questions that don't repeat "peace"** — from anyone within a window after peace spoke, and **proactive** openings on a floor-open lull), drafts each via the agent, then gates it against the same blocking mechanics (floor open, not stale, budget, one-at-a-time) before delivering. Pure heuristics (silence ladder, turn-yield, address/follow-up, energy, social budget, staleness) + a pure reducer; engine fully tested with injected draft + fake executor.
  - **The register-or-discard invariant:** a turn touches history (persist + agent context) ONLY when `speech.finished` confirms delivery. Barged-in, stale, or floor-blocked drafts leave zero trace — peace can never believe it said something it didn't.
  - **Peace remembers its own turns:** registered turns are persisted under the `peace` speaker namespace — they ground the agent (renderConversation shows "peace (you)") and appear in the workspace, but are **excluded from artifact extraction** (`@peace/pipeline`), so peace never "decides" things or assigns itself tasks.
  - `matchWakePhrase` moved to `@peace/core` (reused by the router); `draftResponse` gains a `mode` (addressed/follow-up/proactive) so it's reticent when volunteering; the adapter surfaces speech finished/aborted callbacks. The old `voice-reply.ts` wake-loop is replaced by the router; the spoken `"peace, stop"` control intent still leaves the call.

  Social budget caps unsolicited speech; proactive is cooldown- and energy-gated to avoid over-talking before the heuristics are tuned on real logs.

- cc8e2fa: Conversational response agent harness (`@peace/agent`, router/05, decision D13).

  Replaces the stopgap where spoken replies re-ran the artifact extraction pipeline. New `draftResponse()` is a bounded tool-calling loop (AI SDK v5 `generateText` + tools, `stopWhen: stepCountIs(6)`):

  - **Speaker-clear context:** `renderConversation` renders the transcript tail as attributed markdown (`[01:31] **Alice:** …`) — the always-present grounding handed to the model.
  - **Tools:** read-only context fetchers (`get_decisions` / `get_action_items` / `get_summary` / `get_open_questions` / `get_key_points` / `search_transcript`) that read current state cheaply (no pipeline rerun), plus terminal `respond` / `stay_silent` tools (no `execute`, so calling one ends the loop). The terminal actions map 1:1 onto the router's `speak`/`stay_silent`.
  - **Persona:** warm & conversational, with a hard brevity/read-the-room guardrail (1–3 sentences for voice, may stay silent, never fabricates).
  - **Wiring:** `voice-reply.ts` drafts via the agent for wake-matched voice addresses (the `stop` control intent still leaves the call); disabled gracefully without `ANTHROPIC_API_KEY`. Never throws — failures resolve to silence.

  This resolves router/01's open question (answer formulation = a responder service, not an in-router effect) and makes replies both more conversational and much faster than the old extraction-per-reply path. Citations for spoken replies and write/mutating tools are deferred follow-ups.

### Patch Changes

- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/core@0.2.0
  - @peace/db@0.2.0
  - @peace/ai@0.2.0
  - @peace/logger@0.2.0
