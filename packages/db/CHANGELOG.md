# @peace/db

## 0.2.0

### Minor Changes

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- 559b223: Platform-abstraction foundation for the phase-2 realtime upgrade (realtime/00, decisions D7–D9).

  - `ConversationEvent.source` is now structured `{ platform, medium }`: platform open (Discord now; Zoom/WhatsApp/Apple Messages/phone later, no core changes needed), medium a closed `voice | text` enum. Legacy flat strings bridge via `parseConversationSource`; DB migration `0001` adds `platform`/`medium` columns with a total backfill (the flat `source` column is dual-written during the transition).
  - New `PlatformAdapter` contract in `@peace/adapters`: capability declarations, typed push handlers (text, voice ingress, speaker presence, closed, error), egress seam (sendText/speak/abortSpeech), and both voice-ingress shapes — per-speaker streams (Discord/Zoom) and mixed audio with STT-delegated diarization (WhatsApp/phone) — as first-class variants.
  - New `@peace/session` package: `createLiveSession` is the platform-agnostic composition root (adapter + STT + db → committed segments). Discord voice capture moved out of the bot's inline `voice.ts` into a `DiscordPlatformAdapter` behind the seam; the bot no longer writes segments directly.
  - `StreamingSpeechToText` interface added to `@peace/transcription` (interims + committed, optional diarization) — the seam streaming STT (realtime/02) implements next; batch `SpeechToText` remains the permanent degradation path.
  - CLI gains `replay-live <file>`: a transcript driven through the same live session orchestrator as a real call — the proof that replay and live are one code path.

  Behavior is unchanged this release (same batch STT, same artifacts, same speaker ids); this lays the seams the realtime features attach to.

- 1638e1e: Voice presence, the liveness contract, and minimal "speak when addressed" (realtime/06; decisions D2 Aura, D11, D12).

  - **Voice output (D2 = Deepgram Aura):** new `TextToSpeech` interface + `createDeepgramTts` in `@peace/transcription` (streams linear16 PCM, `AbortSignal`-cancellable). Discord egress is implemented — `speak`/`abortSpeech`/`sendText` play through an `AudioPlayer` (mono→stereo up-mix, `StreamType.Raw`), with barge-in (`receiver.speaking` → `abortSpeech`) cancelling mid-utterance.
  - **Liveness contract (platform-agnostic):** `createBackendHealth` (consecutive-failure state machine over STT calls → degraded/recovered) + `createLivenessController` (announce once per episode: local voice clip in the call + chat). When the AI backend is unreachable but Discord is up, the bot now says so in-band instead of sitting silent. The clip is pre-rendered and played locally (no network) — `pnpm --filter @peace/bot-discord gen-offline-clip`, git-ignored.
  - **Speak when addressed (B1):** `matchWakePhrase` (in `@peace/session`) + a router-shaped voice-reply loop — saying "peace, …" in a call runs the existing artifact pipeline, posts the full answer to chat, and speaks a trimmed form. **Control intents execute rather than generate**: "peace, stop/leave" makes the bot acknowledge in voice, leave the call, and finalize (sharing `handleStop`'s logic) — it no longer routes the command to the artifact pipeline and silently stays.
  - **Auto-rejoin & clean exit:** on a permanent voice drop the bot rejoins if humans remain (bounded backoff) else exits cleanly with a chat prompt; the voice channel is persisted (`meetings.voice_channel_id`, additive migration) so a process restart auto-rejoins the same call.

  Offline notification is proactive-only this round (no local wake-word dependency); the reactive "say Peace while offline" path is deferred. Behavior for text-only meetings and the CLI is unchanged.

### Patch Changes

- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/core@0.2.0
