import { randomUUID } from 'node:crypto';
import { conversationEventSchema, type ConversationEvent } from '@peace/core';

export interface DiscordTextInput {
  meetingId: string;
  authorId: string;
  authorLabel: string;
  content: string;

  /** Milliseconds since meeting start. */
  offsetMs: number;
}

/**
 * Normalize a Discord chat message into a ConversationEvent. Kept free of
 * discord.js types so the adapter seam stays platform-agnostic.
 */
export function discordTextEvent (input: DiscordTextInput): ConversationEvent {
  return conversationEventSchema.parse({
    id          : randomUUID(),
    meetingId   : input.meetingId,
    speakerId   : `discord:${input.authorId}`,
    speakerLabel: input.authorLabel,
    text        : input.content,
    tStart      : input.offsetMs,
    tEnd        : input.offsetMs,
    confidence  : 1,
    source      : 'discord-text'
  });
}
