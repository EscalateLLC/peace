# @peace/transcription

## 0.2.0

### Minor Changes

- d8ab0e5: Switch voice output to ElevenLabs (D2 revised) + playback volume control.

  An ears test found Deepgram Aura sounded robotic and mangled spelled-out/punctuated text ("C-H-E-E-S-E" came out garbled mid-word). The logs confirmed the delivery pipeline was healthy — full-duration clean playback, no errors — so it was a synthesis-quality problem in the provider, exactly the swap the `TextToSpeech` seam was built for.

  - **New `createElevenLabsTts`** (plain `fetch`, **no new dependency**) streams pcm_24000 mono from ElevenLabs. `createTextToSpeech()` factory auto-selects: `ELEVENLABS_API_KEY` → ElevenLabs (most natural), else Deepgram Aura, else voice replies disabled. Voice via `PEACE_ELEVENLABS_VOICE`, model via `PEACE_ELEVENLABS_MODEL` (default `eleven_turbo_v2_5`).
  - **Discord adapter** now converts any provider PCM to Discord's 48kHz stereo: a streaming linear resampler (24k→48k for ElevenLabs) + the existing mono→stereo up-mix, and applies a configurable **`PEACE_TTS_VOLUME`** (0..2, default 0.7) via `inlineVolume`.
  - `toSpokenText` normalizes em/en dashes to a comma pause (they read awkwardly and tripped the old engine).

  Aura remains a zero-config fallback. Set `ELEVENLABS_API_KEY` (and optionally a voice id) in `.env` to use ElevenLabs — see `.env.example`.

- a6b97c0: Initial scaffold: ConversationEvent core schemas, Discord text/voice + transcript-file adapters, Deepgram STT, windowed extraction pipeline with evidence linking, SQLite persistence, workspace UI (web), Discord bot worker, CLI replay harness, and the structured logging ring buffer.
- 559b223: Platform-abstraction foundation for the phase-2 realtime upgrade (realtime/00, decisions D7–D9).

  - `ConversationEvent.source` is now structured `{ platform, medium }`: platform open (Discord now; Zoom/WhatsApp/Apple Messages/phone later, no core changes needed), medium a closed `voice | text` enum. Legacy flat strings bridge via `parseConversationSource`; DB migration `0001` adds `platform`/`medium` columns with a total backfill (the flat `source` column is dual-written during the transition).
  - New `PlatformAdapter` contract in `@peace/adapters`: capability declarations, typed push handlers (text, voice ingress, speaker presence, closed, error), egress seam (sendText/speak/abortSpeech), and both voice-ingress shapes — per-speaker streams (Discord/Zoom) and mixed audio with STT-delegated diarization (WhatsApp/phone) — as first-class variants.
  - New `@peace/session` package: `createLiveSession` is the platform-agnostic composition root (adapter + STT + db → committed segments). Discord voice capture moved out of the bot's inline `voice.ts` into a `DiscordPlatformAdapter` behind the seam; the bot no longer writes segments directly.
  - `StreamingSpeechToText` interface added to `@peace/transcription` (interims + committed, optional diarization) — the seam streaming STT (realtime/02) implements next; batch `SpeechToText` remains the permanent degradation path.
  - CLI gains `replay-live <file>`: a transcript driven through the same live session orchestrator as a real call — the proof that replay and live are one code path.

  Behavior is unchanged this release (same batch STT, same artifacts, same speaker ids); this lays the seams the realtime features attach to.

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

### Patch Changes

- Updated dependencies [a6b97c0]
- Updated dependencies [cc8e2fa]
- Updated dependencies [559b223]
- Updated dependencies [e517b6d]
- Updated dependencies [d8ab0e5]
- Updated dependencies [1638e1e]
  - @peace/core@0.2.0
