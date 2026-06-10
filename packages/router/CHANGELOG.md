# @peace/router

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

- cc8e2fa: The participation router (router/06, decision D1 → custom zero-dep engine): peace now decides _when_ to speak, not just _what_.

  - **New `@peace/router`** — `createParticipationRouter`: a background watcher that folds the conversation into state and nominates candidates (explicit address, **follow-up questions that don't repeat "peace"** — from anyone within a window after peace spoke, and **proactive** openings on a floor-open lull), drafts each via the agent, then gates it against the same blocking mechanics (floor open, not stale, budget, one-at-a-time) before delivering. Pure heuristics (silence ladder, turn-yield, address/follow-up, energy, social budget, staleness) + a pure reducer; engine fully tested with injected draft + fake executor.
  - **The register-or-discard invariant:** a turn touches history (persist + agent context) ONLY when `speech.finished` confirms delivery. Barged-in, stale, or floor-blocked drafts leave zero trace — peace can never believe it said something it didn't.
  - **Peace remembers its own turns:** registered turns are persisted under the `peace` speaker namespace — they ground the agent (renderConversation shows "peace (you)") and appear in the workspace, but are **excluded from artifact extraction** (`@peace/pipeline`), so peace never "decides" things or assigns itself tasks.
  - `matchWakePhrase` moved to `@peace/core` (reused by the router); `draftResponse` gains a `mode` (addressed/follow-up/proactive) so it's reticent when volunteering; the adapter surfaces speech finished/aborted callbacks. The old `voice-reply.ts` wake-loop is replaced by the router; the spoken `"peace, stop"` control intent still leaves the call.

  Social budget caps unsolicited speech; proactive is cooldown- and energy-gated to avoid over-talking before the heuristics are tuned on real logs.

- d8ab0e5: Error boundaries for the voice path — peace never fails silently again.

  The switch to ElevenLabs exposed a gap: when the account had no billing, every synthesis returned a 402 that was thrown correctly but then _mislogged as a draft error_, surfaced nowhere, and left the bot a silent ghost — it drafted a reply it could never speak. This introduces a typed error vocabulary and a graceful-degradation boundary so an external-service failure is always visible and the user still gets their answer.

  - **`PeaceError` vocabulary** (`@peace/core`): a classified, surfaceable domain error carrying `code` (`tts.auth` / `tts.rate_limited` / `tts.transient` / `tts.unavailable` / …), a human-safe `userMessage`, `retryable`, and `cause`. Thrown at the TTS seams, classified at the boundary. `isPeaceError` / `asPeaceError` normalize anything thrown.
  - **TTS classification + runtime fallback** (`@peace/transcription`): ElevenLabs and Deepgram map HTTP status → `PeaceError` and tag results with their `provider`. `createTextToSpeech()` now returns a **composite** that tries ElevenLabs → Deepgram Aura in order, so a billing/outage on the primary transparently falls back to the backup voice.
  - **The speak boundary** (`@peace/bot-discord`): a new `createSpeakExecutor` degrades voice → backup voice → **text in chat + an operational notice**, never silence. A total TTS failure still delivers the drafted answer as text (with a `[voice unavailable — replying in text]` note), registers that turn, surfaces a notice, and logs `voice.tts_failed` with the real `code`. The participation router now runs even with **no** TTS configured (it answers in text instead of staying silent).
  - **`router.speak_failed`** (`@peace/router`): delivery failures are logged distinctly from `router.draft_error`.
  - **`meeting.notice` delta** (`@peace/core`, `@peace/transport`, `@peace/ui`): an unsequenced, ephemeral operational signal (same family as interim/provisional — WS-only, not persisted) rendered as an auto-dismissing, severity-colored banner in the workspace. Switch/failure notices fire once per episode to avoid spam.

  `stt.*` / `llm.*` codes are reserved so those seams can adopt the same vocabulary later.

- d8ab0e5: Three live-voice fixes from a field session.

  - **Answers no longer get cut off mid-sentence (the serious one).** Barge-in fired on the _first_ Discord voice-activity blip, so a cough, a back-channel "mm-hmm", or — most often — the bot's own voice echoing back through an open mic instantly aborted its reply. Barge-in is now **content-aware**: raw voice activity never interrupts the bot. It cuts off mid-reply only when a human has a _reason_ to — they address it ("peace, …") or lead with an interruption cue ("wait", "hold on", "stop", "never mind"; new `isInterruptCue`). Otherwise the bot finishes its (short) turn. An addressed interruption then redirects into a fresh reply.
  - **Quieter by default.** `PEACE_TTS_VOLUME` default lowered 0.7 → 0.5 (ElevenLabs/Aura run hot); still env-tunable.
  - **Pronunciation lexicon.** New `PEACE_TTS_LEXICON` — a JSON map of name/word → phonetic respelling, applied before synthesis (e.g. `{"Xsno":"Ex-no"}`). Respelling is the only reliable, provider-agnostic fix for names the engine garbles (`eleven_turbo_v2_5` ignores SSML `<phoneme>`).

### Patch Changes

- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/core@0.2.0
  - @peace/logger@0.2.0
