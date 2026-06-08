---
'@peace/agent': minor
'@peace/bot-discord': minor
---

The bot now honors "leave the call" and knows when it's on its backup voice.

Two field-reported failures, both rooted in the conversational agent being unaware of its own situation:

- **It wouldn't leave when asked.** Spoken leave requests ("leave the call", "you can head out", "get out") were only intercepted when prefixed by the wake word *and* phrased as `stop|leave|end`; everything else fell through to the agent, which had no leave capability and hallucinated *"I can't physically exit the call."* Now:
  - The agent has a **`leave_call` tool** and is told in its prompt that it CAN leave — so any natural phrasing works and it never falsely refuses. A `leave_call` decision is honored outside the router (speaks an optional goodbye, then disconnects + finalizes).
  - A **high-precision deterministic fast-path** (`matchLeaveCommand`) still catches explicit commands instantly (no LLM round-trip): wake-prefixed ("peace, head out") or a 2nd-person directive ("you can leave", "can you disconnect"). It deliberately does NOT fire on a human announcing their own departure ("I have to leave the call") or incidental verbs ("did you leave the door open").
- **It didn't tell anyone it had switched to the backup voice.** The ElevenLabs→Deepgram fallback only lit up the workspace banner. Now the switch is also **announced once in the Discord channel**, and the agent is given an **operational note** ("you're on your backup voice…") so it can explain accurately if a participant asks why it sounds different.
- **`agent.responded` now logs a short `preview`** of what was said (first ~140 chars), so the logs can be correlated to what was actually heard — previously only `chars` (length) was recorded, which made debugging "what did it say?" impossible.
