import { z } from 'zod';

export const meetingPlatformSchema = z.enum(['discord', 'upload']);

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
  externalRef: z.string().nullable()
});

export type Meeting = z.infer<typeof meetingSchema>;
