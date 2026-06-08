---
'@peace/core': minor
'@peace/transport': minor
'@peace/session': minor
'@peace/adapters': minor
'@peace/ui': minor
'@peace/web': minor
'@peace/bot-discord': minor
'@peace/cli': minor
---

Realtime workspace transport (realtime/04 + workspace/02, D6) and defensive meeting lifecycle (realtime/05, D10).

- New `@peace/transport`: `createDeltaServer` — WS fan-out of `WorkspaceDelta`s (`ws://localhost:8787`, `ws` exact-pinned), per-meeting seq, heartbeat, subscribe protocol (schemas shared via `@peace/core`). SQLite stays the source of truth; the socket is delivery only.
- `WorkspaceDataAdapter` gains optional `subscribe()`; `WorkspaceShell` applies pushed deltas when available (segments appear in ~instantly instead of the 2.5s poll) with a quiet "live: delayed" hint when degraded. The web adapter owns the WS client, reconnect with jittered backoff, and a polling fallback that synthesizes the same deltas — total transport failure is exactly the old UX.
- The bot hosts the delta server and publishes segments (via the session's new `onDelta` hook), meeting status transitions, and artifacts. `replay-live <file> --ws --pace <ms>` live-streams a fixture into the workspace — demo and transport harness in one.
- Defensive lifecycle (restore-as-active policy): startup recovery sweep restores meetings orphaned by a process death (transcript-bearing → active again with a channel notice; empty husks → failed; unreachable channel → complete), graceful SIGINT/SIGTERM shutdown announces, leaves voice cleanly and pauses meetings for the next boot, failed joins roll their meeting back instead of leaving zombie 'live' rows, and stop/artifact commands restore from the DB when process memory forgot the meeting. Voice connections get a 5s reconnect grace on mid-call drops.
