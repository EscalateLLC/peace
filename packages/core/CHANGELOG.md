# @peace/core

## 0.2.0

### Minor Changes

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- cc8e2fa: The participation router (router/06, decision D1 → custom zero-dep engine): peace now decides _when_ to speak, not just _what_.

  - **New `@peace/router`** — `createParticipationRouter`: a background watcher that folds the conversation into state and nominates candidates (explicit address, **follow-up questions that don't repeat "peace"** — from anyone within a window after peace spoke, and **proactive** openings on a floor-open lull), drafts each via the agent, then gates it against the same blocking mechanics (floor open, not stale, budget, one-at-a-time) before delivering. Pure heuristics (silence ladder, turn-yield, address/follow-up, energy, social budget, staleness) + a pure reducer; engine fully tested with injected draft + fake executor.
  - **The register-or-discard invariant:** a turn touches history (persist + agent context) ONLY when `speech.finished` confirms delivery. Barged-in, stale, or floor-blocked drafts leave zero trace — peace can never believe it said something it didn't.
  - **Peace remembers its own turns:** registered turns are persisted under the `peace` speaker namespace — they ground the agent (renderConversation shows "peace (you)") and appear in the workspace, but are **excluded from artifact extraction** (`@peace/pipeline`), so peace never "decides" things or assigns itself tasks.
  - `matchWakePhrase` moved to `@peace/core` (reused by the router); `draftResponse` gains a `mode` (addressed/follow-up/proactive) so it's reticent when volunteering; the adapter surfaces speech finished/aborted callbacks. The old `voice-reply.ts` wake-loop is replaced by the router; the spoken `"peace, stop"` control intent still leaves the call.

  Social budget caps unsolicited speech; proactive is cooldown- and energy-gated to avoid over-talking before the heuristics are tuned on real logs.

- 559b223: Platform-abstraction foundation for the phase-2 realtime upgrade (realtime/00, decisions D7–D9).

  - `ConversationEvent.source` is now structured `{ platform, medium }`: platform open (Discord now; Zoom/WhatsApp/Apple Messages/phone later, no core changes needed), medium a closed `voice | text` enum. Legacy flat strings bridge via `parseConversationSource`; DB migration `0001` adds `platform`/`medium` columns with a total backfill (the flat `source` column is dual-written during the transition).
  - New `PlatformAdapter` contract in `@peace/adapters`: capability declarations, typed push handlers (text, voice ingress, speaker presence, closed, error), egress seam (sendText/speak/abortSpeech), and both voice-ingress shapes — per-speaker streams (Discord/Zoom) and mixed audio with STT-delegated diarization (WhatsApp/phone) — as first-class variants.
  - New `@peace/session` package: `createLiveSession` is the platform-agnostic composition root (adapter + STT + db → committed segments). Discord voice capture moved out of the bot's inline `voice.ts` into a `DiscordPlatformAdapter` behind the seam; the bot no longer writes segments directly.
  - `StreamingSpeechToText` interface added to `@peace/transcription` (interims + committed, optional diarization) — the seam streaming STT (realtime/02) implements next; batch `SpeechToText` remains the permanent degradation path.
  - CLI gains `replay-live <file>`: a transcript driven through the same live session orchestrator as a real call — the proof that replay and live are one code path.

  Behavior is unchanged this release (same batch STT, same artifacts, same speaker ids); this lays the seams the realtime features attach to.

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

- 1638e1e: Voice presence, the liveness contract, and minimal "speak when addressed" (realtime/06; decisions D2 Aura, D11, D12).

  - **Voice output (D2 = Deepgram Aura):** new `TextToSpeech` interface + `createDeepgramTts` in `@peace/transcription` (streams linear16 PCM, `AbortSignal`-cancellable). Discord egress is implemented — `speak`/`abortSpeech`/`sendText` play through an `AudioPlayer` (mono→stereo up-mix, `StreamType.Raw`), with barge-in (`receiver.speaking` → `abortSpeech`) cancelling mid-utterance.
  - **Liveness contract (platform-agnostic):** `createBackendHealth` (consecutive-failure state machine over STT calls → degraded/recovered) + `createLivenessController` (announce once per episode: local voice clip in the call + chat). When the AI backend is unreachable but Discord is up, the bot now says so in-band instead of sitting silent. The clip is pre-rendered and played locally (no network) — `pnpm --filter @peace/bot-discord gen-offline-clip`, git-ignored.
  - **Speak when addressed (B1):** `matchWakePhrase` (in `@peace/session`) + a router-shaped voice-reply loop — saying "peace, …" in a call runs the existing artifact pipeline, posts the full answer to chat, and speaks a trimmed form. **Control intents execute rather than generate**: "peace, stop/leave" makes the bot acknowledge in voice, leave the call, and finalize (sharing `handleStop`'s logic) — it no longer routes the command to the artifact pipeline and silently stays.
  - **Auto-rejoin & clean exit:** on a permanent voice drop the bot rejoins if humans remain (bounded backoff) else exits cleanly with a chat prompt; the voice channel is persisted (`meetings.voice_channel_id`, additive migration) so a process restart auto-rejoins the same call.

  Offline notification is proactive-only this round (no local wake-word dependency); the reactive "say Peace while offline" path is deferred. Behavior for text-only meetings and the CLI is unchanged.
