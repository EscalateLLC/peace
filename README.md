# peace

**AI participants for your conversations.**

Invite a peace bot into a call or chat. It listens, transcribes who said what, and turns the discussion into structured, *evidence-linked* artifacts — summaries, action items, decisions, open questions, and flow diagrams — organized in a workspace you can explore afterwards. Address it directly ("@peace, summarize what we have so far") and it answers in the conversation.

> **Status: early MVP.** This is a young project under active development. The core loop works — a bot has sat in real group calls and produced real workspaces — but plenty is unbuilt, rough, or subject to change without ceremony. Read [What works today](#what-works-today) and [What doesn't yet](#what-doesnt-yet) for the honest picture.

## Why

Conversations are where decisions actually happen — and then they evaporate. Notes are partial, memories disagree, and "wait, did we decide that?" costs every team hours a week. Meeting transcribers help, but a transcript is a haystack, and AI summaries of haystacks have a trust problem: was that action item actually said, or invented?

peace's answer is **evidence linking**: every artifact it produces — every decision, every action item, every node in a diagram — cites the exact transcript segments it came from. Click the evidence chip, see the moment it was said, by whom, at what timestamp. If the AI can't ground an item in the transcript, the item is dropped before you ever see it. That property is enforced in the schema layer, not the prompt.

The longer-term ambition is a participant, not a stenographer: a bot that weaves in and out of live conversation — answering when addressed, staying silent when it should, organizing the discussion *while it happens*.

## What works today

- **Discord bot (voice + text).** Joins your voice channel on `@peace join`, announces itself, and transcribes per speaker (Discord's per-user audio streams make speaker attribution exact, not guessed). Text channels can be captured with `@peace start`.
- **Artifact generation.** On `@peace stop` (or on demand: `@peace summarize` / `decisions` / `actions` / `questions` / `diagram`) the transcript is distilled into six artifact types, each item carrying its source-segment citations and an uncertainty flag.
- **The workspace.** A local web app (Next.js) showing the transcript, artifact panels, and a rendered Mermaid diagram. Evidence chips highlight and scroll to the cited transcript moments. Artifacts are immutably versioned — regeneration adds a version, never rewrites history. Diagram source is hand-editable.
- **Transcript replay.** A CLI ingests written transcripts through the exact same pipeline (`pnpm --filter @peace/cli start run fixtures/sample.txt`) — useful for testing, demos, and processing meetings that happened elsewhere.
- **Local-first.** Everything lives in a SQLite file on your machine. No accounts, no cloud storage; the only external calls are the AI services you bring keys for (Anthropic for analysis, Deepgram for speech-to-text) and Discord itself.

## What doesn't (yet)

Transparency about the gaps:

- **Analysis is batch, not live.** Transcription streams in near-real-time, but artifacts are generated on stop/on demand — the live "watch it organize itself" experience is the next major phase.
- **The bot doesn't speak.** It replies in text chat; voice responses (and the judgment about *when* to speak in a live conversation) are designed but not built.
- **Discord only.** Zoom/Meet/Teams/WhatsApp/phone are on the roadmap; Discord came first because bots are first-class citizens there.
- **Single-user, no auth.** It's a local tool right now — no accounts, sharing, or multi-user workspaces.
- **The UI is functional, not finished.** A real design pass is planned; what you see is the working skeleton.
- **Costs are yours.** Transcription and LLM calls run on your API keys; long meetings cost real (if modest) money.

## How it works

Every input source — live Discord voice, Discord text, an uploaded transcript file — is normalized by an adapter into a single `ConversationEvent` stream (speaker, text, timestamps, confidence). Everything downstream is medium-agnostic: the same extraction pipeline, evidence validation, and workspace serve all sources. That's why testing with a text file exercises the same code path as a live call.

```
apps/      bot-discord · cli · web
packages/  core (event + artifact schemas) · adapters · transcription · pipeline
           db (SQLite/Drizzle) · ui (workspace components) · ai · logger · config-presets
```

- **Stack:** TypeScript end-to-end, pnpm workspaces, Next.js + React (web), discord.js + @discordjs/voice (bot), Vercel AI SDK + Claude (extraction), Deepgram (STT), Drizzle + better-sqlite3 (storage), Tailwind, vitest.
- **Supply-chain posture:** dependency install scripts are blocked by default (explicit allowlist), new package versions are held for 24h before install (`minimumReleaseAge`), all versions exactly pinned, lockfile committed.
- **Observability:** every process writes structured JSONL logs to a local ring buffer (`.logs/`) — debugging is evidence-based here too.

## Getting started

Prereqs: Node 22, pnpm 11 (`corepack enable`), a [Discord application](https://discord.com/developers/applications) with the **Message Content** privileged gateway intent enabled, plus API keys for [Anthropic](https://console.anthropic.com/) and [Deepgram](https://console.deepgram.com/).

```sh
pnpm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY, DEEPGRAM_API_KEY, DISCORD_BOT_TOKEN

# try the pipeline with no Discord setup at all:
pnpm --filter @peace/cli start run fixtures/sample.txt
pnpm dev                    # workspace at http://localhost:3000

# or the full experience:
pnpm bot                    # start the worker, then in Discord:
                            #   @peace join   (from a voice channel)
                            #   @peace stop   (generate final artifacts)
```

No API keys yet? `pnpm --filter @peace/cli start seed-demo` populates a complete demo meeting so you can explore the workspace immediately.

Invite URL scopes for the bot: `bot` with View Channels, Send Messages, Read Message History, Connect.

## Contributing & feedback

Issues and discussions are welcome — especially reports from real meetings (what was extracted well, what was missed, what felt wrong). The project is early enough that experience reports shape the roadmap directly. Note the license below before planning commercial use.

## License

[PolyForm Noncommercial 1.0.0](./LICENSE.md) — source-available: you may use, modify, and share this software for **noncommercial purposes**. Commercial use is not permitted.
