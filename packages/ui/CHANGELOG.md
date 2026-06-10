# @peace/ui

## 0.2.0

### Minor Changes

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- e517b6d: Realtime workspace transport (realtime/04 + workspace/02, D6) and defensive meeting lifecycle (realtime/05, D10).

  - New `@peace/transport`: `createDeltaServer` — WS fan-out of `WorkspaceDelta`s (`ws://localhost:8787`, `ws` exact-pinned), per-meeting seq, heartbeat, subscribe protocol (schemas shared via `@peace/core`). SQLite stays the source of truth; the socket is delivery only.
  - `WorkspaceDataAdapter` gains optional `subscribe()`; `WorkspaceShell` applies pushed deltas when available (segments appear in ~instantly instead of the 2.5s poll) with a quiet "live: delayed" hint when degraded. The web adapter owns the WS client, reconnect with jittered backoff, and a polling fallback that synthesizes the same deltas — total transport failure is exactly the old UX.
  - The bot hosts the delta server and publishes segments (via the session's new `onDelta` hook), meeting status transitions, and artifacts. `replay-live <file> --ws --pace <ms>` live-streams a fixture into the workspace — demo and transport harness in one.
  - Defensive lifecycle (restore-as-active policy): startup recovery sweep restores meetings orphaned by a process death (transcript-bearing → active again with a channel notice; empty husks → failed; unreachable channel → complete), graceful SIGINT/SIGTERM shutdown announces, leaves voice cleanly and pauses meetings for the next boot, failed joins roll their meeting back instead of leaving zombie 'live' rows, and stop/artifact commands restore from the DB when process memory forgot the meeting. Voice connections get a 5s reconnect grace on mid-call drops.

- d8ab0e5: Error boundaries for the voice path — peace never fails silently again.

  The switch to ElevenLabs exposed a gap: when the account had no billing, every synthesis returned a 402 that was thrown correctly but then _mislogged as a draft error_, surfaced nowhere, and left the bot a silent ghost — it drafted a reply it could never speak. This introduces a typed error vocabulary and a graceful-degradation boundary so an external-service failure is always visible and the user still gets their answer.

  - **`PeaceError` vocabulary** (`@peace/core`): a classified, surfaceable domain error carrying `code` (`tts.auth` / `tts.rate_limited` / `tts.transient` / `tts.unavailable` / …), a human-safe `userMessage`, `retryable`, and `cause`. Thrown at the TTS seams, classified at the boundary. `isPeaceError` / `asPeaceError` normalize anything thrown.
  - **TTS classification + runtime fallback** (`@peace/transcription`): ElevenLabs and Deepgram map HTTP status → `PeaceError` and tag results with their `provider`. `createTextToSpeech()` now returns a **composite** that tries ElevenLabs → Deepgram Aura in order, so a billing/outage on the primary transparently falls back to the backup voice.
  - **The speak boundary** (`@peace/bot-discord`): a new `createSpeakExecutor` degrades voice → backup voice → **text in chat + an operational notice**, never silence. A total TTS failure still delivers the drafted answer as text (with a `[voice unavailable — replying in text]` note), registers that turn, surfaces a notice, and logs `voice.tts_failed` with the real `code`. The participation router now runs even with **no** TTS configured (it answers in text instead of staying silent).
  - **`router.speak_failed`** (`@peace/router`): delivery failures are logged distinctly from `router.draft_error`.
  - **`meeting.notice` delta** (`@peace/core`, `@peace/transport`, `@peace/ui`): an unsequenced, ephemeral operational signal (same family as interim/provisional — WS-only, not persisted) rendered as an auto-dismissing, severity-colored banner in the workspace. Switch/failure notices fire once per episode to avoid spam.

  `stt.*` / `llm.*` codes are reserved so those seams can adopt the same vocabulary later.

### Patch Changes

- c95fd25: Rebuild the meeting workspace on the design system (themed, live data)

  Replace the Tailwind `@peace/ui` `WorkspaceShell` at `/meeting/[id]` with a new intent-canvas workspace built on `@peace/design` tokens + the kit. Three themed panels over live meeting data: the transcript as kit `ChatBubble`s, the artifacts as decision/action/question/key-point cards (with evidence chips + uncertainty), and the Mermaid diagram re-rendered in mermaid's light/dark theme to match the active peace theme. Evidence cross-linking lights source segments on hover and drills into a themed modal (kit `ZoomStack`) showing the transcript turns that justify each item; tap a panel surface to expand. The fetch + live-subscribe + delta logic is extracted into a reusable `useWorkspace` hook (`applyWorkspaceDelta` is now exported from `@peace/ui`). The whole surface — including the diagram — re-skins with the theme switcher.

- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/core@0.2.0
