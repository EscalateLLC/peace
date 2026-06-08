---
'@peace/transcription': minor
'@peace/bot-discord': minor
---

Switch voice output to ElevenLabs (D2 revised) + playback volume control.

An ears test found Deepgram Aura sounded robotic and mangled spelled-out/punctuated text ("C-H-E-E-S-E" came out garbled mid-word). The logs confirmed the delivery pipeline was healthy — full-duration clean playback, no errors — so it was a synthesis-quality problem in the provider, exactly the swap the `TextToSpeech` seam was built for.

- **New `createElevenLabsTts`** (plain `fetch`, **no new dependency**) streams pcm_24000 mono from ElevenLabs. `createTextToSpeech()` factory auto-selects: `ELEVENLABS_API_KEY` → ElevenLabs (most natural), else Deepgram Aura, else voice replies disabled. Voice via `PEACE_ELEVENLABS_VOICE`, model via `PEACE_ELEVENLABS_MODEL` (default `eleven_turbo_v2_5`).
- **Discord adapter** now converts any provider PCM to Discord's 48kHz stereo: a streaming linear resampler (24k→48k for ElevenLabs) + the existing mono→stereo up-mix, and applies a configurable **`PEACE_TTS_VOLUME`** (0..2, default 0.7) via `inlineVolume`.
- `toSpokenText` normalizes em/en dashes to a comma pause (they read awkwardly and tripped the old engine).

Aura remains a zero-config fallback. Set `ELEVENLABS_API_KEY` (and optionally a voice id) in `.env` to use ElevenLabs — see `.env.example`.
