import { randomUUID } from 'node:crypto';
import { conversationEventSchema, speakerId, type ConversationEvent, type ConversationEventStream } from '@peace/core';

/**
 * Parses plain-text transcripts into ConversationEvents.
 *
 * Supported line shapes (blank lines and # comments are skipped):
 *   [00:12] Alice: We should ship the Discord bot first.
 *   [1:02:03] Bob: Agreed.
 *   Charlie: No timestamp on this one.
 *
 * Lines without a timestamp are placed sequentially after the previous line,
 * with a duration estimated from text length (~reading pace).
 */
export function parseTranscript (content: string, meetingId: string): ConversationEvent[] {
  const linePattern = /^(?:\[(?<stamp>\d{1,2}(?::\d{2}){1,2})\]\s*)?(?<speaker>[^:[\]]{1,64}):\s*(?<text>.+)$/u;
  const events: ConversationEvent[] = [];
  let cursor = 0;

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const match = linePattern.exec(line);

    if (!match?.groups) {
      throw new Error(`unparseable transcript line: "${line}"`);
    }

    const { stamp, speaker, text } = match.groups as {
      stamp?: string;
      speaker: string;
      text: string;
    };
    const tStart = stamp ? parseStamp(stamp) : cursor;
    const tEnd = tStart + estimateDurationMs(text);

    cursor = tEnd + 500;
    events.push(conversationEventSchema.parse({
      id: randomUUID(),
      meetingId,

      // The `user:` namespace is grandfathered from MVP1 — persisted rows
      // key speaker color/labels on it, so it must never change.
      speakerId   : speakerId('user', speaker.trim().toLowerCase()),
      speakerLabel: speaker.trim(),
      text        : text.trim(),
      tStart,
      tEnd,
      confidence  : 1,
      source      : {
        platform: 'upload',
        medium  : 'text'
      }
    }));
  }

  return events;
}

/** "mm:ss" or "hh:mm:ss" → milliseconds. */
function parseStamp (stamp: string): number {
  const parts = stamp.split(':').map(Number);
  const [a, b, c] = parts;

  if (parts.length === 3) {
    return ((a ?? 0) * 3600 + (b ?? 0) * 60 + (c ?? 0)) * 1000;
  }

  return ((a ?? 0) * 60 + (b ?? 0)) * 1000;
}

function estimateDurationMs (text: string): number {
  const words = text.split(/\s+/u).length;

  return Math.max(1500, words * 400);
}

/** The adapter interface: a transcript file as a ConversationEventStream. */
export async function* transcriptFileStream (content: string, meetingId: string): ConversationEventStream {
  for (const event of parseTranscript(content, meetingId)) {
    yield event;
  }
}
