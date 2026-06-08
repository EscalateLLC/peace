---
'@peace/router': minor
'@peace/bot-discord': patch
---

Three live-voice fixes from a field session.

- **Answers no longer get cut off mid-sentence (the serious one).** Barge-in fired on the *first* Discord voice-activity blip, so a cough, a back-channel "mm-hmm", or — most often — the bot's own voice echoing back through an open mic instantly aborted its reply. Barge-in is now **content-aware**: raw voice activity never interrupts the bot. It cuts off mid-reply only when a human has a *reason* to — they address it ("peace, …") or lead with an interruption cue ("wait", "hold on", "stop", "never mind"; new `isInterruptCue`). Otherwise the bot finishes its (short) turn. An addressed interruption then redirects into a fresh reply.
- **Quieter by default.** `PEACE_TTS_VOLUME` default lowered 0.7 → 0.5 (ElevenLabs/Aura run hot); still env-tunable.
- **Pronunciation lexicon.** New `PEACE_TTS_LEXICON` — a JSON map of name/word → phonetic respelling, applied before synthesis (e.g. `{"Xsno":"Ex-no"}`). Respelling is the only reliable, provider-agnostic fix for names the engine garbles (`eleven_turbo_v2_5` ignores SSML `<phoneme>`).
