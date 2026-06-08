import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDb,
  createMeeting,
  insertSegments,
  migrate,
  replaceDecisions,
  type PeaceDb
} from '@peace/db';
import { readDecisions, searchTranscript } from './tools';

let dir: string;
let db: PeaceDb;
let meetingId: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'peace-agent-'));
  db = createDb({ path: join(dir, 'test.db') });
  migrate(db);
  meetingId = createMeeting(db, {
    title    : 'Agent tools test',
    platform : 'upload',
    startedAt: 0
  }).id;
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, {
    recursive: true,
    force    : true
  });
});

function segment (text: string, tStart: number) {
  return {
    id          : crypto.randomUUID(),
    meetingId,
    speakerId   : 'discord:1',
    speakerLabel: 'Alice',
    text,
    tStart,
    tEnd        : tStart + 1000,
    confidence  : 1,
    source      : {
      platform: 'discord',
      medium  : 'voice'
    } as const
  };
}

describe('agent read tools', () => {
  it('readDecisions returns current-state decisions', () => {
    replaceDecisions(db, meetingId, [{
      description     : 'Ship the timeline view',
      rationale       : 'Tested better',
      sourceSegmentIds: ['s1'],
      uncertain       : false
    }], 0);

    expect(readDecisions(db, meetingId)).toEqual([{
      description: 'Ship the timeline view',
      rationale  : 'Tested better'
    }]);
  });

  it('searchTranscript matches case-insensitively and ignores empty queries', () => {
    insertSegments(db, [
      segment('We should ship the portal Friday', 0),
      segment('The classifier is deferred to Q4', 2000)
    ]);

    expect(searchTranscript(db, meetingId, 'CLASSIFIER')).toEqual([{
      speaker: 'Alice',
      text   : 'The classifier is deferred to Q4'
    }]);
    expect(searchTranscript(db, meetingId, '   ')).toEqual([]);
  });
});
