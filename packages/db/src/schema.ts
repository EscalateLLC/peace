import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const meetings = sqliteTable('meetings', {
  id      : text('id').primaryKey(),
  title   : text('title').notNull(),
  platform: text('platform', { enum: ['discord', 'upload'] }).notNull(),
  status  : text('status', { enum: ['live', 'processing', 'complete', 'failed'] }).notNull(),

  /** Epoch milliseconds. */
  startedAt: integer('started_at').notNull(),
  endedAt  : integer('ended_at'),

  /** Platform-specific locator (e.g. discord guild/channel), if any. */
  externalRef: text('external_ref')
});

export const transcriptSegments = sqliteTable('transcript_segments', {
  id       : text('id').primaryKey(),
  meetingId: text('meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  speakerId   : text('speaker_id').notNull(),
  speakerLabel: text('speaker_label').notNull(),
  text        : text('text').notNull(),

  /** Milliseconds since meeting start. */
  tStart: integer('t_start').notNull(),
  tEnd  : integer('t_end').notNull(),

  confidence: real('confidence').notNull(),
  source    : text('source', { enum: ['discord-voice', 'discord-text', 'transcript-file'] }).notNull()
}, table => [index('segments_meeting_time_idx').on(table.meetingId, table.tStart)]);

/**
 * Immutable artifact versions: regeneration inserts version + 1, never updates.
 */
export const artifacts = sqliteTable('artifacts', {
  id       : text('id').primaryKey(),
  meetingId: text('meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: [
      'summary',
      'action-items',
      'decisions',
      'open-questions',
      'key-points',
      'diagram'
    ]
  }).notNull(),
  title: text('title').notNull(),

  /** JSON, shape discriminated by `type` (see @peace/core artifactContentSchema). */
  content  : text('content', { mode: 'json' }).notNull(),
  version  : integer('version').notNull(),
  createdAt: integer('created_at').notNull()
}, table => [
  uniqueIndex('artifacts_meeting_type_version_idx').on(table.meetingId, table.type, table.version)
]);

/**
 * Current-state action items (latest extraction), kept queryable for future
 * integrations (Linear/Jira sync). History lives in artifact versions.
 */
export const actionItems = sqliteTable('action_items', {
  id       : text('id').primaryKey(),
  meetingId: text('meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  assignee   : text('assignee'),
  dueDate    : text('due_date'),
  status     : text('status', { enum: ['open', 'done', 'dropped'] }).notNull()
    .default('open'),

  /** JSON array of transcript segment ids. */
  sourceSegmentIds: text('source_segment_ids', { mode: 'json' }).notNull(),
  uncertain       : integer('uncertain', { mode: 'boolean' }).notNull()
    .default(false)
}, table => [index('action_items_meeting_idx').on(table.meetingId)]);

export const decisions = sqliteTable('decisions', {
  id       : text('id').primaryKey(),
  meetingId: text('meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  rationale  : text('rationale'),

  /** JSON array of transcript segment ids. */
  sourceSegmentIds: text('source_segment_ids', { mode: 'json' }).notNull(),
  uncertain       : integer('uncertain', { mode: 'boolean' }).notNull()
    .default(false),
  createdAt: integer('created_at').notNull()
}, table => [index('decisions_meeting_idx').on(table.meetingId)]);
