import { z } from 'zod';

/**
 * Open like conversationPlatformSchema — new platforms must not require a
 * core/schema change. See KNOWN_PLATFORMS for the documented set.
 */
export const meetingPlatformSchema = z.string().min(1);

export type MeetingPlatform = z.infer<typeof meetingPlatformSchema>;

export const meetingStatusSchema = z.enum(['live', 'processing', 'complete', 'failed']);

export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export const meetingSchema = z.object({
  id      : z.string().min(1),
  title   : z.string().min(1),
  platform: meetingPlatformSchema,
  status  : meetingStatusSchema,

  /** Epoch milliseconds. */
  startedAt: z.number().nonnegative(),
  endedAt  : z.number().nonnegative()
    .nullable(),

  /** Platform-specific locator (e.g. discord guildId/channelId), if any. */
  externalRef: z.string().nullable(),

  /**
   * Voice/audio channel the bot is attached to, if any — persisted so a
   * process restart can auto-rejoin the same call (realtime/06). Null for
   * text-only meetings.
   */
  voiceChannelId: z.string().nullable()
});

export type Meeting = z.infer<typeof meetingSchema>;
