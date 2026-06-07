import type { Meeting } from '@peace/core';
import { createMeeting, updateMeetingStatus, type PeaceDb } from '@peace/db';

export interface ActiveMeeting {
  meetingId: string;
  guildId: string;
  textChannelId: string;
  startedAt: number;
  voiceChannelId: string | null;
}

/** One active meeting per text channel; key = guildId/channelId. */
const active = new Map<string, ActiveMeeting>();

function key (guildId: string, textChannelId: string): string {
  return `${guildId}/${textChannelId}`;
}

export function getActiveMeeting (guildId: string, textChannelId: string): ActiveMeeting | undefined {
  return active.get(key(guildId, textChannelId));
}

export function startMeeting (db: PeaceDb, options: {
  guildId: string;
  textChannelId: string;
  title: string;
  voiceChannelId?: string | null;
}): { meeting: Meeting; state: ActiveMeeting } {
  const startedAt = Date.now();
  const meeting = createMeeting(db, {
    title      : options.title,
    platform   : 'discord',
    startedAt,
    externalRef: key(options.guildId, options.textChannelId)
  });
  const state: ActiveMeeting = {
    meetingId     : meeting.id,
    guildId       : options.guildId,
    textChannelId : options.textChannelId,
    startedAt,
    voiceChannelId: options.voiceChannelId ?? null
  };

  active.set(key(options.guildId, options.textChannelId), state);

  return {
    meeting,
    state
  };
}

export function endMeeting (db: PeaceDb, guildId: string, textChannelId: string): ActiveMeeting | undefined {
  const state = active.get(key(guildId, textChannelId));

  if (state) {
    active.delete(key(guildId, textChannelId));
    updateMeetingStatus(db, state.meetingId, 'processing', Date.now());
  }

  return state;
}
