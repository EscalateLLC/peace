import { z } from 'zod';

/**
 * Where a ConversationEvent came from. Every adapter normalizes its medium
 * into this enum; nothing downstream may branch on anything more specific.
 */
export const conversationSourceSchema = z.enum([
  'discord-voice',
  'discord-text',
  'transcript-file'
]);

export type ConversationSource = z.infer<typeof conversationSourceSchema>;

/**
 * The central seam of peace: one utterance by one speaker, normalized from
 * any input medium (live voice, chat message, transcript file line).
 * Persisted 1:1 as a transcript segment.
 */
export const conversationEventSchema = z.object({
  id          : z.string().min(1),
  meetingId   : z.string().min(1),
  speakerId   : z.string().min(1),
  speakerLabel: z.string().min(1),
  text        : z.string().min(1),

  /** Milliseconds since meeting start. */
  tStart: z.number().nonnegative(),
  tEnd  : z.number().nonnegative(),

  /** STT confidence; 1 for text-native sources. */
  confidence: z.number().min(0)
    .max(1),
  source: conversationSourceSchema
}).refine(event => event.tEnd >= event.tStart, { message: 'tEnd must be >= tStart' });

export type ConversationEvent = z.infer<typeof conversationEventSchema>;

/** Every input adapter yields this. */
export type ConversationEventStream = AsyncIterable<ConversationEvent>;
