import type { ConversationEvent } from '@peace/core';

/** Keep the rendered tail near a window's worth of context (cf. pipeline windowing). */
const DEFAULT_MAX_CHARS = 7000;
const DEFAULT_BOT_LABEL = 'peace';

export interface RenderConversationOptions {
  maxChars?: number;

  /** Speaker label that is the bot itself (rendered as "peace (you)"). */
  botSpeakerLabel?: string;
}

function formatMs (ms: number): string {
  const seconds = Math.floor(ms / 1000);

  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Render the tail of a conversation as speaker-labeled markdown — the always-
 * present grounding handed to the response agent. Clear attribution is the
 * point: every line names who spoke so the model never confuses voices.
 *
 *   [01:31] **Alice:** peace, what did we land on for the timeline?
 *   [01:42] **peace (you):** We went with the timeline view.
 *
 * Tail-limited to `maxChars`, oldest line dropped first, chronological order.
 */
export function renderConversation (events: ConversationEvent[], options: RenderConversationOptions = {}): string {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const botLabel = (options.botSpeakerLabel ?? DEFAULT_BOT_LABEL).toLowerCase();
  const lines: string[] = [];
  let total = 0;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i] as ConversationEvent;
    const who = event.speakerLabel.toLowerCase() === botLabel ? 'peace (you)' : event.speakerLabel;
    const line = `[${formatMs(event.tStart)}] **${who}:** ${event.text}`;

    if (total + line.length > maxChars && lines.length > 0) {
      break;
    }

    lines.push(line);
    total += line.length + 1;
  }

  return lines.reverse().join('\n');
}
