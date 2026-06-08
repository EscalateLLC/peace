import { z } from 'zod';

/**
 * The medium an event arrived through. Deliberately a small closed set —
 * downstream code may branch on medium (voice needs STT, text does not).
 */
export const conversationMediumSchema = z.enum(['voice', 'text']);

export type ConversationMedium = z.infer<typeof conversationMediumSchema>;

/**
 * The platform that carried the conversation. Deliberately open — platforms
 * grow over time (Discord today; Zoom, WhatsApp, Apple Messages, phone later)
 * and nothing downstream of packages/adapters may branch on it. Provenance
 * only; behavior differences are expressed through PlatformCapabilities in
 * packages/adapters, never by string-matching the platform.
 */
export const conversationPlatformSchema = z.string().min(1);

export type ConversationPlatform = z.infer<typeof conversationPlatformSchema>;

/** Non-authoritative list of platforms peace targets today, for labels/tooling. */
export const KNOWN_PLATFORMS = [
  'discord',
  'zoom',
  'whatsapp',
  'apple-messages',
  'phone',
  'upload'
] as const;

/**
 * Where a ConversationEvent came from: which platform carried it and through
 * which medium. Every adapter normalizes into this; nothing downstream may
 * branch on anything more specific than `medium`.
 */
export const conversationSourceSchema = z.object({
  platform: conversationPlatformSchema,
  medium  : conversationMediumSchema
});

export type ConversationSource = z.infer<typeof conversationSourceSchema>;

/** MVP1 flat source strings (persisted in pre-migration rows) → platform × medium. */
const LEGACY_SOURCES: Record<string, ConversationSource> = {
  'discord-voice': {
    platform: 'discord',
    medium  : 'voice'
  },
  'discord-text': {
    platform: 'discord',
    medium  : 'text'
  },
  'transcript-file': {
    platform: 'upload',
    medium  : 'text'
  }
};

/**
 * Bridge both source representations: the structured object, a legacy MVP1
 * string, or a flattened `${platform}-${medium}` string. The single mapping
 * shared by the DB migration backfill and the repository read path.
 */
export function parseConversationSource (raw: unknown): ConversationSource {
  if (typeof raw === 'string') {
    const legacy = LEGACY_SOURCES[raw];

    if (legacy) {
      return legacy;
    }

    // `${platform}-${medium}`; platform may itself contain dashes, medium never does.
    const splitAt = raw.lastIndexOf('-');

    if (splitAt > 0) {
      return conversationSourceSchema.parse({
        platform: raw.slice(0, splitAt),
        medium  : raw.slice(splitAt + 1)
      });
    }
  }

  return conversationSourceSchema.parse(raw);
}

/** Flatten a source for single-column storage: `${platform}-${medium}`. */
export function flattenConversationSource (source: ConversationSource): string {
  return `${source.platform}-${source.medium}`;
}

/**
 * Speaker identity convention: `${namespace}:${nativeId}`. The namespace is
 * the platform name (`discord:81726…`); transcript files keep the
 * grandfathered `user:` namespace — persisted rows must never re-key.
 * Stable within a platform; the router keys per-speaker state on this, and
 * diarized mixed-audio sources mint synthetic ids under the same grammar.
 */
export function speakerId (namespace: string, nativeId: string): string {
  return `${namespace}:${nativeId}`;
}

export function parseSpeakerId (id: string): { namespace: string; nativeId: string } {
  const splitAt = id.indexOf(':');

  if (splitAt <= 0 || splitAt === id.length - 1) {
    throw new Error(`speakerId must be "namespace:nativeId", got "${id}"`);
  }

  return {
    namespace: id.slice(0, splitAt),
    nativeId : id.slice(splitAt + 1)
  };
}

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
