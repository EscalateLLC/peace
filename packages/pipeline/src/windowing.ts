import type { ConversationEvent } from '@peace/core';

export interface TranscriptWindow {
  events: ConversationEvent[];
  segmentIds: Set<string>;
}

/** ~1500 tokens of transcript per extraction call (chars / 4 heuristic). */
const DEFAULT_MAX_CHARS = 6000;

/**
 * Split a transcript into sequential windows for extraction. Each window is
 * small enough for one structured-extraction call; a running summary carries
 * context between windows so nothing is resent.
 */
export function windowEvents (events: ConversationEvent[], maxChars: number = DEFAULT_MAX_CHARS): TranscriptWindow[] {
  const windows: TranscriptWindow[] = [];
  let current: ConversationEvent[] = [];
  let size = 0;

  for (const event of events) {
    if (current.length > 0 && size + event.text.length > maxChars) {
      windows.push(toWindow(current));
      current = [];
      size = 0;
    }

    current.push(event);
    size += event.text.length;
  }

  if (current.length > 0) {
    windows.push(toWindow(current));
  }

  return windows;
}

function toWindow (events: ConversationEvent[]): TranscriptWindow {
  return {
    events,
    segmentIds: new Set(events.map(event => event.id))
  };
}

/**
 * Render a window as prompt text with short segment aliases (S1, S2, ...).
 * Aliases keep prompts compact; the model cites them and we map back to the
 * real segment ids afterwards.
 */
export function renderWindow (window: TranscriptWindow): { text: string; aliasToId: Map<string, string> } {
  const aliasToId = new Map<string, string>();
  const lines = window.events.map((event, index) => {
    const alias = `S${index + 1}`;

    aliasToId.set(alias, event.id);

    return `[${alias}] [${formatMs(event.tStart)}] ${event.speakerLabel}: ${event.text}`;
  });

  return {
    text: lines.join('\n'),
    aliasToId
  };
}

function formatMs (ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
