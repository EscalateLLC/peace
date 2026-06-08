import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, max } from 'drizzle-orm';
import {
  flattenConversationSource,
  parseConversationSource,
  type ActionItem,
  type Artifact,
  type ArtifactType,
  type ConversationEvent,
  type Decision,
  type Meeting,
  type MeetingPlatform
} from '@peace/core';
import type { PeaceDb } from './client';
import { actionItems, artifacts, decisions, meetings, transcriptSegments } from './schema';

// ─── Meetings ────────────────────────────────────────────────────────────────

export interface CreateMeetingInput {
  title: string;
  platform: MeetingPlatform;
  startedAt: number;
  externalRef?: string | null;
}

export function createMeeting (db: PeaceDb, input: CreateMeetingInput): Meeting {
  const meeting: Meeting = {
    id            : randomUUID(),
    title         : input.title,
    platform      : input.platform,
    status        : 'live',
    startedAt     : input.startedAt,
    endedAt       : null,
    externalRef   : input.externalRef ?? null,
    voiceChannelId: null
  };

  db.insert(meetings).values(meeting)
    .run();

  return meeting;
}

/** Persist the voice channel the bot is attached to (for restart auto-rejoin). */
export function setMeetingVoiceChannel (db: PeaceDb, id: string, voiceChannelId: string | null): void {
  db.update(meetings)
    .set({ voiceChannelId })
    .where(eq(meetings.id, id))
    .run();
}

export function getMeeting (db: PeaceDb, id: string): Meeting | null {
  const row = db.select().from(meetings)
    .where(eq(meetings.id, id))
    .get();

  return row ?? null;
}

export function listMeetings (db: PeaceDb): Meeting[] {
  return db.select().from(meetings)
    .orderBy(desc(meetings.startedAt))
    .all();
}

export function updateMeetingStatus (db: PeaceDb, id: string, status: Meeting['status'], endedAt?: number): void {
  db.update(meetings)
    .set(endedAt === undefined ? { status } : {
      status,
      endedAt
    })
    .where(eq(meetings.id, id))
    .run();
}

// ─── Transcript segments ─────────────────────────────────────────────────────

type SegmentRow = typeof transcriptSegments.$inferSelect;

/** Structured source ↔ columns. Reads prefer the structured columns and fall
 *  back to deriving from the legacy flat `source` for pre-backfill rows. */
function rowToEvent (row: SegmentRow): ConversationEvent {
  const { source, platform, medium, ...rest } = row;

  return {
    ...rest,
    source: platform !== null && medium !== null ? {
      platform,
      medium
    } : parseConversationSource(source)
  };
}

export function insertSegments (db: PeaceDb, events: ConversationEvent[]): void {
  if (events.length === 0) {
    return;
  }

  db.insert(transcriptSegments).values(events.map(event => ({
    ...event,
    source  : flattenConversationSource(event.source),
    platform: event.source.platform,
    medium  : event.source.medium
  })))
    .run();
}

export function getSegments (db: PeaceDb, meetingId: string): ConversationEvent[] {
  return db.select().from(transcriptSegments)
    .where(eq(transcriptSegments.meetingId, meetingId))
    .orderBy(asc(transcriptSegments.tStart))
    .all()
    .map(rowToEvent);
}

/** Segments after a watermark, for the live-polling workspace transcript. */
export function getSegmentsSince (db: PeaceDb, meetingId: string, afterTStart: number): ConversationEvent[] {
  return db.select().from(transcriptSegments)
    .where(and(eq(transcriptSegments.meetingId, meetingId), gt(transcriptSegments.tStart, afterTStart)))
    .orderBy(asc(transcriptSegments.tStart))
    .all()
    .map(rowToEvent);
}

// ─── Artifacts (immutable versions) ──────────────────────────────────────────

export interface InsertArtifactInput {
  meetingId: string;
  type: ArtifactType;
  title: string;
  content: unknown;
  createdAt: number;
}

/**
 * Insert a new artifact version: version = max(version for meeting+type) + 1,
 * atomically. Existing versions are never mutated.
 */
export function insertArtifact (db: PeaceDb, input: InsertArtifactInput): Artifact {
  return db.transaction(tx => {
    const current = tx.select({ latest: max(artifacts.version) })
      .from(artifacts)
      .where(and(eq(artifacts.meetingId, input.meetingId), eq(artifacts.type, input.type)))
      .get();

    const artifact = {
      id       : randomUUID(),
      meetingId: input.meetingId,
      type     : input.type,
      title    : input.title,
      content  : input.content,
      version  : (current?.latest ?? 0) + 1,
      createdAt: input.createdAt
    };

    tx.insert(artifacts).values(artifact)
      .run();

    return artifact as Artifact;
  });
}

/** Latest version of each artifact type for a meeting. */
export function getLatestArtifacts (db: PeaceDb, meetingId: string): Artifact[] {
  const all = db.select().from(artifacts)
    .where(eq(artifacts.meetingId, meetingId))
    .orderBy(asc(artifacts.type), desc(artifacts.version))
    .all();

  const seen = new Set<string>();

  return all.filter(artifact => {
    if (seen.has(artifact.type)) {
      return false;
    }

    seen.add(artifact.type);

    return true;
  }) as Artifact[];
}

export function getArtifactVersions (db: PeaceDb, meetingId: string, type: ArtifactType): Artifact[] {
  return db.select().from(artifacts)
    .where(and(eq(artifacts.meetingId, meetingId), eq(artifacts.type, type)))
    .orderBy(desc(artifacts.version))
    .all() as Artifact[];
}

// ─── Current-state action items / decisions ──────────────────────────────────

export function replaceActionItems (db: PeaceDb, meetingId: string, items: ActionItem[]): void {
  db.transaction(tx => {
    tx.delete(actionItems).where(eq(actionItems.meetingId, meetingId))
      .run();

    if (items.length > 0) {
      tx.insert(actionItems).values(items.map(item => ({
        id              : randomUUID(),
        meetingId,
        description     : item.description,
        assignee        : item.assignee,
        dueDate         : item.dueDate,
        status          : 'open' as const,
        sourceSegmentIds: item.sourceSegmentIds,
        uncertain       : item.uncertain
      })))
        .run();
    }
  });
}

export function replaceDecisions (db: PeaceDb, meetingId: string, items: Decision[], createdAt: number): void {
  db.transaction(tx => {
    tx.delete(decisions).where(eq(decisions.meetingId, meetingId))
      .run();

    if (items.length > 0) {
      tx.insert(decisions).values(items.map(item => ({
        id              : randomUUID(),
        meetingId,
        description     : item.description,
        rationale       : item.rationale,
        sourceSegmentIds: item.sourceSegmentIds,
        uncertain       : item.uncertain,
        createdAt
      })))
        .run();
    }
  });
}

export function getActionItems (db: PeaceDb, meetingId: string) {
  return db.select().from(actionItems)
    .where(eq(actionItems.meetingId, meetingId))
    .all();
}

export function getDecisions (db: PeaceDb, meetingId: string) {
  return db.select().from(decisions)
    .where(eq(decisions.meetingId, meetingId))
    .all();
}
