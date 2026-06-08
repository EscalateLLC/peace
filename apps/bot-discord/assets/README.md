# bot-discord assets

## `offline-degraded.pcm` (generated, git-ignored)

The pre-rendered "my connection dropped" clip the bot plays **locally** in a
voice call when its AI backend is unreachable (so it needs no network to
announce its own degradation — see `internal/phase-2-follow-up/realtime/06`).

It is git-ignored because it's a ~2 MB binary that regenerates deterministically.
Generate it once (online, requires `DEEPGRAM_API_KEY`):

```
pnpm --filter @peace/bot-discord gen-offline-clip
```

Format: 48 kHz stereo signed-16-bit little-endian PCM. If the file is absent,
the bot still announces degradation in chat — the voice clip is best-effort.
