---
'@peace/core': minor
'@peace/transcription': minor
'@peace/bot-discord': minor
'@peace/router': minor
'@peace/transport': minor
'@peace/ui': minor
---

Error boundaries for the voice path — peace never fails silently again.

The switch to ElevenLabs exposed a gap: when the account had no billing, every synthesis returned a 402 that was thrown correctly but then *mislogged as a draft error*, surfaced nowhere, and left the bot a silent ghost — it drafted a reply it could never speak. This introduces a typed error vocabulary and a graceful-degradation boundary so an external-service failure is always visible and the user still gets their answer.

- **`PeaceError` vocabulary** (`@peace/core`): a classified, surfaceable domain error carrying `code` (`tts.auth` / `tts.rate_limited` / `tts.transient` / `tts.unavailable` / …), a human-safe `userMessage`, `retryable`, and `cause`. Thrown at the TTS seams, classified at the boundary. `isPeaceError` / `asPeaceError` normalize anything thrown.
- **TTS classification + runtime fallback** (`@peace/transcription`): ElevenLabs and Deepgram map HTTP status → `PeaceError` and tag results with their `provider`. `createTextToSpeech()` now returns a **composite** that tries ElevenLabs → Deepgram Aura in order, so a billing/outage on the primary transparently falls back to the backup voice.
- **The speak boundary** (`@peace/bot-discord`): a new `createSpeakExecutor` degrades voice → backup voice → **text in chat + an operational notice**, never silence. A total TTS failure still delivers the drafted answer as text (with a `[voice unavailable — replying in text]` note), registers that turn, surfaces a notice, and logs `voice.tts_failed` with the real `code`. The participation router now runs even with **no** TTS configured (it answers in text instead of staying silent).
- **`router.speak_failed`** (`@peace/router`): delivery failures are logged distinctly from `router.draft_error`.
- **`meeting.notice` delta** (`@peace/core`, `@peace/transport`, `@peace/ui`): an unsequenced, ephemeral operational signal (same family as interim/provisional — WS-only, not persisted) rendered as an auto-dismissing, severity-colored banner in the workspace. Switch/failure notices fire once per episode to avoid spam.

`stt.*` / `llm.*` codes are reserved so those seams can adopt the same vocabulary later.
