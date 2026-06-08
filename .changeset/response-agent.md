---
'@peace/agent': minor
'@peace/bot-discord': minor
---

Conversational response agent harness (`@peace/agent`, router/05, decision D13).

Replaces the stopgap where spoken replies re-ran the artifact extraction pipeline. New `draftResponse()` is a bounded tool-calling loop (AI SDK v5 `generateText` + tools, `stopWhen: stepCountIs(6)`):

- **Speaker-clear context:** `renderConversation` renders the transcript tail as attributed markdown (`[01:31] **Alice:** …`) — the always-present grounding handed to the model.
- **Tools:** read-only context fetchers (`get_decisions` / `get_action_items` / `get_summary` / `get_open_questions` / `get_key_points` / `search_transcript`) that read current state cheaply (no pipeline rerun), plus terminal `respond` / `stay_silent` tools (no `execute`, so calling one ends the loop). The terminal actions map 1:1 onto the router's `speak`/`stay_silent`.
- **Persona:** warm & conversational, with a hard brevity/read-the-room guardrail (1–3 sentences for voice, may stay silent, never fabricates).
- **Wiring:** `voice-reply.ts` drafts via the agent for wake-matched voice addresses (the `stop` control intent still leaves the call); disabled gracefully without `ANTHROPIC_API_KEY`. Never throws — failures resolve to silence.

This resolves router/01's open question (answer formulation = a responder service, not an in-router effect) and makes replies both more conversational and much faster than the old extraction-per-reply path. Citations for spoken replies and write/mutating tools are deferred follow-ups.
