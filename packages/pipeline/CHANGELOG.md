# @peace/pipeline

## 0.2.0

### Minor Changes

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- cc8e2fa: The participation router (router/06, decision D1 → custom zero-dep engine): peace now decides _when_ to speak, not just _what_.

  - **New `@peace/router`** — `createParticipationRouter`: a background watcher that folds the conversation into state and nominates candidates (explicit address, **follow-up questions that don't repeat "peace"** — from anyone within a window after peace spoke, and **proactive** openings on a floor-open lull), drafts each via the agent, then gates it against the same blocking mechanics (floor open, not stale, budget, one-at-a-time) before delivering. Pure heuristics (silence ladder, turn-yield, address/follow-up, energy, social budget, staleness) + a pure reducer; engine fully tested with injected draft + fake executor.
  - **The register-or-discard invariant:** a turn touches history (persist + agent context) ONLY when `speech.finished` confirms delivery. Barged-in, stale, or floor-blocked drafts leave zero trace — peace can never believe it said something it didn't.
  - **Peace remembers its own turns:** registered turns are persisted under the `peace` speaker namespace — they ground the agent (renderConversation shows "peace (you)") and appear in the workspace, but are **excluded from artifact extraction** (`@peace/pipeline`), so peace never "decides" things or assigns itself tasks.
  - `matchWakePhrase` moved to `@peace/core` (reused by the router); `draftResponse` gains a `mode` (addressed/follow-up/proactive) so it's reticent when volunteering; the adapter surfaces speech finished/aborted callbacks. The old `voice-reply.ts` wake-loop is replaced by the router; the spoken `"peace, stop"` control intent still leaves the call.

  Social budget caps unsolicited speech; proactive is cooldown- and energy-gated to avoid over-talking before the heuristics are tuned on real logs.

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
