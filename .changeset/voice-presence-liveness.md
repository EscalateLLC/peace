---
'@peace/transcription': minor
'@peace/session': minor
'@peace/core': minor
'@peace/db': minor
'@peace/bot-discord': minor
---

Voice presence, the liveness contract, and minimal "speak when addressed" (realtime/06; decisions D2 Aura, D11, D12).

- **Voice output (D2 = Deepgram Aura):** new `TextToSpeech` interface + `createDeepgramTts` in `@peace/transcription` (streams linear16 PCM, `AbortSignal`-cancellable). Discord egress is implemented — `speak`/`abortSpeech`/`sendText` play through an `AudioPlayer` (mono→stereo up-mix, `StreamType.Raw`), with barge-in (`receiver.speaking` → `abortSpeech`) cancelling mid-utterance.
- **Liveness contract (platform-agnostic):** `createBackendHealth` (consecutive-failure state machine over STT calls → degraded/recovered) + `createLivenessController` (announce once per episode: local voice clip in the call + chat). When the AI backend is unreachable but Discord is up, the bot now says so in-band instead of sitting silent. The clip is pre-rendered and played locally (no network) — `pnpm --filter @peace/bot-discord gen-offline-clip`, git-ignored.
- **Speak when addressed (B1):** `matchWakePhrase` (in `@peace/session`) + a router-shaped voice-reply loop — saying "peace, …" in a call runs the existing artifact pipeline, posts the full answer to chat, and speaks a trimmed form. **Control intents execute rather than generate**: "peace, stop/leave" makes the bot acknowledge in voice, leave the call, and finalize (sharing `handleStop`'s logic) — it no longer routes the command to the artifact pipeline and silently stays.
- **Auto-rejoin & clean exit:** on a permanent voice drop the bot rejoins if humans remain (bounded backoff) else exits cleanly with a chat prompt; the voice channel is persisted (`meetings.voice_channel_id`, additive migration) so a process restart auto-rejoins the same call.

Offline notification is proactive-only this round (no local wake-word dependency); the reactive "say Peace while offline" path is deferred. Behavior for text-only meetings and the CLI is unchanged.
