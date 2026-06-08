import { describe, expect, it } from 'vitest';
import type { Artifact, ConversationEvent } from '@peace/core';
import type { WorkspaceData } from './adapter';
import { applyWorkspaceDelta } from './workspace-delta';

function segment (id: string, tStart: number): ConversationEvent {
  return {
    id,
    meetingId   : 'meeting-1',
    speakerId   : 'user:alice',
    speakerLabel: 'Alice',
    text        : `segment ${id}`,
    tStart,
    tEnd        : tStart + 1000,
    confidence  : 1,
    source      : {
      platform: 'upload',
      medium  : 'text'
    }
  };
}

function artifact (type: Artifact['type'], version: number): Artifact {
  return {
    id       : `${type}-v${version}`,
    meetingId: 'meeting-1',
    type,
    title    : type,
    content  : {},
    version,
    createdAt: version
  };
}

const base: WorkspaceData = {
  meeting: {
    id            : 'meeting-1',
    title         : 'Test',
    platform      : 'discord',
    status        : 'live',
    startedAt     : 0,
    endedAt       : null,
    externalRef   : null,
    voiceChannelId: null
  },
  segments : [segment('a', 0)],
  artifacts: [artifact('summary', 1)]
};

describe('applyWorkspaceDelta', () => {
  it('inserts committed segments in time order and dedupes by id', () => {
    const withB = applyWorkspaceDelta(base, {
      type   : 'segment.committed',
      seq    : 1,
      payload: segment('b', 500)
    });
    const withEarlier = applyWorkspaceDelta(withB, {
      type   : 'segment.committed',
      seq    : 2,
      payload: segment('c', 250)
    });

    expect(withEarlier.segments.map(item => item.id)).toEqual(['a', 'c', 'b']);

    const duplicate = applyWorkspaceDelta(withEarlier, {
      type   : 'segment.committed',
      seq    : 3,
      payload: segment('b', 500)
    });

    expect(duplicate).toBe(withEarlier);
  });

  it('replaces artifacts only with newer versions', () => {
    const upgraded = applyWorkspaceDelta(base, {
      type   : 'artifact.committed',
      seq    : 1,
      payload: artifact('summary', 2)
    });

    expect(upgraded.artifacts.find(item => item.type === 'summary')?.version).toBe(2);

    const stale = applyWorkspaceDelta(upgraded, {
      type   : 'artifact.committed',
      seq    : 2,
      payload: artifact('summary', 1)
    });

    expect(stale).toBe(upgraded);
  });

  it('applies status transitions and ignores interims for now', () => {
    const completed = applyWorkspaceDelta(base, {
      type   : 'meeting.status',
      seq    : 1,
      payload: {
        meetingId: 'meeting-1',
        status   : 'complete'
      }
    });

    expect(completed.meeting.status).toBe('complete');

    const interim = applyWorkspaceDelta(base, {
      type   : 'segment.interim',
      payload: {
        meetingId   : 'meeting-1',
        speakerId   : 'user:alice',
        speakerLabel: 'Alice',
        text        : 'typing…'
      }
    });

    expect(interim).toBe(base);
  });

  it('does not mutate snapshot state for notices (rendered as a banner instead)', () => {
    const afterNotice = applyWorkspaceDelta(base, {
      type   : 'meeting.notice',
      payload: {
        meetingId: 'meeting-1',
        severity : 'error',
        code     : 'tts.auth',
        message  : 'Voice service failed — replying in text.',
        at       : 1000
      }
    });

    expect(afterNotice).toBe(base);
  });
});
