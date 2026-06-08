import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDb,
  createMeeting,
  getArtifactVersions,
  getLatestArtifacts,
  getSegments,
  getSegmentsSince,
  insertArtifact,
  insertSegments,
  migrate,
  updateMeetingStatus
} from './index';
import type { PeaceDb } from './client';

let dir: string;
let dbPath: string;
let db: PeaceDb;
let open: PeaceDb[] = [];

function track (instance: PeaceDb): PeaceDb {
  open.push(instance);

  return instance;
}

function segment (meetingId: string, overrides: Record<string, unknown> = {}) {
  return {
    id          : crypto.randomUUID(),
    meetingId,
    speakerId   : 'user:alice',
    speakerLabel: 'Alice',
    text        : 'Hello there.',
    tStart      : 0,
    tEnd        : 1000,
    confidence  : 0.9,
    source      : {
      platform: 'upload',
      medium  : 'text'
    } as const,
    ...overrides
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'peace-db-'));
  dbPath = join(dir, 'test.db');
  db = track(createDb({ path: dbPath }));
  migrate(db);
});

afterEach(() => {
  for (const instance of open) {
    instance.$client.close();
  }

  open = [];
  rmSync(dir, {
    recursive: true,
    force    : true
  });
});

describe('meetings + segments', () => {
  it('creates a meeting and reads segments back in time order', () => {
    const meeting = createMeeting(db, {
      title    : 'Test',
      platform : 'discord',
      startedAt: 1000
    });

    insertSegments(db, [
      segment(meeting.id, {
        tStart: 5000,
        tEnd  : 6000,
        text  : 'second'
      }),
      segment(meeting.id, {
        tStart: 1000,
        tEnd  : 2000,
        text  : 'first'
      })
    ]);

    const segments = getSegments(db, meeting.id);

    expect(segments.map(item => item.text)).toEqual(['first', 'second']);
    expect(getSegmentsSince(db, meeting.id, 1000).map(item => item.text)).toEqual(['second']);
  });

  it('reads pre-migration rows (flat source, NULL platform/medium) via the legacy bridge', () => {
    const meeting = createMeeting(db, {
      title    : 'Legacy',
      platform : 'discord',
      startedAt: 1000
    });

    // Simulate an MVP1 row: flat source string, structured columns never backfilled.
    db.$client.prepare(
      `INSERT INTO transcript_segments
         (id, meeting_id, speaker_id, speaker_label, text, t_start, t_end, confidence, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('legacy-1', meeting.id, 'discord:42', 'Alice', 'old row', 0, 1000, 0.9, 'discord-voice');

    const [event] = getSegments(db, meeting.id);

    expect(event?.source).toEqual({
      platform: 'discord',
      medium  : 'voice'
    });
    expect(event?.speakerId).toBe('discord:42');
  });

  it('dual-writes the flat source column alongside the structured columns', () => {
    const meeting = createMeeting(db, {
      title    : 'Dual write',
      platform : 'upload',
      startedAt: 1000
    });

    insertSegments(db, [segment(meeting.id)]);

    const row = db.$client.prepare(
      'SELECT source, platform, medium FROM transcript_segments WHERE meeting_id = ?'
    ).get(meeting.id) as { source: string; platform: string; medium: string };

    expect(row).toEqual({
      source  : 'upload-text',
      platform: 'upload',
      medium  : 'text'
    });
  });

  it('updates meeting status with endedAt', () => {
    const meeting = createMeeting(db, {
      title    : 'Test',
      platform : 'discord',
      startedAt: 1000
    });

    updateMeetingStatus(db, meeting.id, 'complete', 9000);

    const segments = getSegments(db, meeting.id);

    expect(segments).toEqual([]);
  });
});

describe('artifact versioning', () => {
  it('increments versions per meeting+type and never mutates', () => {
    const meeting = createMeeting(db, {
      title    : 'Test',
      platform : 'upload',
      startedAt: 1000
    });

    const content = {
      markdown        : 'v1',
      sourceSegmentIds: []
    };

    const v1 = insertArtifact(db, {
      meetingId: meeting.id,
      type     : 'summary',
      title    : 'Summary',
      content,
      createdAt: 1
    });

    const v2 = insertArtifact(db, {
      meetingId: meeting.id,
      type     : 'summary',
      title    : 'Summary',
      content  : {
        ...content,
        markdown: 'v2'
      },
      createdAt: 2
    });

    const diagram = insertArtifact(db, {
      meetingId: meeting.id,
      type     : 'diagram',
      title    : 'Flow',
      content  : {
        mermaid     : 'flowchart TD\n A-->B',
        nodeEvidence: {}
      },
      createdAt: 3
    });

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(diagram.version).toBe(1);

    const versions = getArtifactVersions(db, meeting.id, 'summary');

    expect(versions.map(item => item.version)).toEqual([2, 1]);

    const latest = getLatestArtifacts(db, meeting.id);

    expect(latest).toHaveLength(2);
    expect(latest.find(item => item.type === 'summary')?.version).toBe(2);
  });
});

describe('WAL two-writer concurrency', () => {
  it('lets two connections (bot + web) write without deadlocking', () => {
    const writerA = track(createDb({ path: dbPath }));
    const writerB = track(createDb({ path: dbPath }));

    const meeting = createMeeting(writerA, {
      title    : 'Concurrent',
      platform : 'discord',
      startedAt: 1000
    });

    for (let index = 0; index < 25; index++) {
      insertSegments(writerA, [segment(meeting.id, {
        tStart: index * 100,
        tEnd  : index * 100 + 50
      })]);
      insertArtifact(writerB, {
        meetingId: meeting.id,
        type     : 'summary',
        title    : 'Summary',
        content  : {
          markdown        : `round ${index}`,
          sourceSegmentIds: []
        },
        createdAt: index
      });
    }

    const reader = track(createDb({
      path    : dbPath,
      readonly: true
    }));

    expect(getSegments(reader, meeting.id)).toHaveLength(25);
    expect(getArtifactVersions(reader, meeting.id, 'summary')).toHaveLength(25);
  });
});
