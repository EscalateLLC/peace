import type { Meeting } from '@peace/core';
import { createMeeting, updateMeetingStatus, type PeaceDb } from '@peace/db';
import type { LiveSession } from '@peace/session';
import type { ParticipationRouter } from '@peace/router';
import type { DiscordPlatformAdapter } from './discord-adapter';

export interface ActiveMeeting {
  meetingId: string;
  guildId: string;
  textChannelId: string;
  startedAt: number;
  voiceChannelId: string | null;

  /** The platform seam: gateway events go to the adapter, which feeds the session. */
  adapter: DiscordPlatformAdapter | null;
  session: LiveSession | null;

  /** Participation router (watcher → draft → gate → register), if voice is available. */
  router: ParticipationRouter | null;
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
    voiceChannelId: options.voiceChannelId ?? null,
    adapter       : null,
    session       : null,
    router        : null
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

/** Every meeting currently captured by this process (for shutdown sweeps). */
export function listActiveMeetings (): ActiveMeeting[] {
  return [...active.values()];
}

/**
 * Re-register a meeting that survived a process death (DB row still 'live',
 * in-memory state lost). Keeps the original meetingId and startedAt so text
 * offsets stay on the meeting's own timeline. The persisted voiceChannelId
 * lets the recovery sweep auto-rejoin the same call when people are still in it.
 */
export function restoreMeeting (meeting: Meeting): ActiveMeeting | null {
  const separator = meeting.externalRef?.indexOf('/') ?? -1;

  if (!meeting.externalRef || separator <= 0) {
    return null;
  }

  const guildId = meeting.externalRef.slice(0, separator);
  const textChannelId = meeting.externalRef.slice(separator + 1);

  if (!textChannelId) {
    return null;
  }

  const state: ActiveMeeting = {
    meetingId     : meeting.id,
    guildId,
    textChannelId,
    startedAt     : meeting.startedAt,
    voiceChannelId: meeting.voiceChannelId,
    adapter       : null,
    session       : null,
    router        : null
  };

  active.set(key(guildId, textChannelId), state);

  return state;
}

/** Roll a meeting back (e.g. a join that never connected): forget it and mark it failed. */
export function discardMeeting (db: PeaceDb, guildId: string, textChannelId: string): ActiveMeeting | undefined {
  const state = active.get(key(guildId, textChannelId));

  if (state) {
    active.delete(key(guildId, textChannelId));
    updateMeetingStatus(db, state.meetingId, 'failed', Date.now());
  }

  return state;
}
