import { describe, expect, it } from 'vitest';
import {
  actionItemSchema,
  artifactTypeSchema,
  conversationEventSchema,
  flattenConversationSource,
  interimSegmentSchema,
  meetingSchema,
  parseArtifactContent,
  parseConversationSource,
  parseSpeakerId,
  speakerId,
  windowExtractionSchema,
  workspaceDeltaSchema
} from './index';

const validEvent = {
  id          : 'seg-1',
  meetingId   : 'meeting-1',
  speakerId   : 'user-42',
  speakerLabel: 'Alice',
  text        : 'I think we should ship the Discord bot first.',
  tStart      : 1000,
  tEnd        : 3500,
  confidence  : 0.94,
  source      : {
    platform: 'discord',
    medium  : 'voice'
  }
};

describe('conversationEventSchema', () => {
  it('round-trips a valid event from every medium and an unknown platform', () => {
    for (const source of [
      {
        platform: 'discord',
        medium  : 'voice'
      },
      {
        platform: 'discord',
        medium  : 'text'
      },
      {
        platform: 'upload',
        medium  : 'text'
      },
      {
        platform: 'some-future-platform',
        medium  : 'voice'
      }
    ]) {
      const parsed = conversationEventSchema.parse({
        ...validEvent,
        source
      });

      expect(parsed.source).toEqual(source);
    }
  });

  it('rejects unknown mediums', () => {
    expect(() => conversationEventSchema.parse({
      ...validEvent,
      source: {
        platform: 'discord',
        medium  : 'hologram'
      }
    })).toThrow();
  });

  it('rejects confidence outside [0, 1]', () => {
    expect(() => conversationEventSchema.parse({
      ...validEvent,
      confidence: 1.2
    })).toThrow();
  });

  it('rejects tEnd before tStart', () => {
    expect(() => conversationEventSchema.parse({
      ...validEvent,
      tStart: 5000,
      tEnd  : 1000
    })).toThrow();
  });

  it('rejects empty text', () => {
    expect(() => conversationEventSchema.parse({
      ...validEvent,
      text: ''
    })).toThrow();
  });
});

describe('conversation source bridging', () => {
  it('maps every legacy MVP1 source string', () => {
    expect(parseConversationSource('discord-voice')).toEqual({
      platform: 'discord',
      medium  : 'voice'
    });
    expect(parseConversationSource('discord-text')).toEqual({
      platform: 'discord',
      medium  : 'text'
    });
    expect(parseConversationSource('transcript-file')).toEqual({
      platform: 'upload',
      medium  : 'text'
    });
  });

  it('round-trips flattened sources, including dashed platform names', () => {
    const source = {
      platform: 'apple-messages',
      medium  : 'text'
    } as const;

    expect(flattenConversationSource(source)).toBe('apple-messages-text');
    expect(parseConversationSource('apple-messages-text')).toEqual(source);
  });

  it('passes structured sources through and rejects garbage', () => {
    expect(parseConversationSource({
      platform: 'zoom',
      medium  : 'voice'
    })).toEqual({
      platform: 'zoom',
      medium  : 'voice'
    });
    expect(() => parseConversationSource('nonsense')).toThrow();
    expect(() => parseConversationSource(42)).toThrow();
  });
});

describe('speaker identity', () => {
  it('preserves the persisted MVP1 formats exactly', () => {
    // These literals are load-bearing: existing rows use them and the UI
    // colors/labels by speakerId. They must never change shape.
    expect(speakerId('discord', '817261111222333444')).toBe('discord:817261111222333444');
    expect(speakerId('user', 'alice')).toBe('user:alice');
  });

  it('parses namespace and nativeId back out', () => {
    expect(parseSpeakerId('discord:42')).toEqual({
      namespace: 'discord',
      nativeId : '42'
    });
    expect(() => parseSpeakerId('no-colon')).toThrow();
    expect(() => parseSpeakerId('dangling:')).toThrow();
  });
});

describe('live wire types', () => {
  it('keeps interims lean — no id, confidence, or timing fields', () => {
    const interim = interimSegmentSchema.parse({
      meetingId   : 'meeting-1',
      speakerId   : 'discord:42',
      speakerLabel: 'Alice',
      text        : 'so what I was thin'
    });

    expect(Object.keys(interim).sort()).toEqual(['meetingId', 'speakerId', 'speakerLabel', 'text']);
  });

  it('sequences committed deltas and leaves interims unsequenced', () => {
    const committed = workspaceDeltaSchema.parse({
      type   : 'segment.committed',
      seq    : 7,
      payload: validEvent
    });

    expect(committed.type).toBe('segment.committed');

    expect(() => workspaceDeltaSchema.parse({
      type   : 'segment.committed',
      payload: validEvent
    })).toThrow();

    const interim = workspaceDeltaSchema.parse({
      type   : 'segment.interim',
      payload: {
        meetingId   : 'meeting-1',
        speakerId   : 'discord:42',
        speakerLabel: 'Alice',
        text        : 'so what I was thin'
      }
    });

    expect(interim.type).toBe('segment.interim');
  });
});

describe('evidence linking', () => {
  it('rejects extracted items without source segments', () => {
    expect(() => actionItemSchema.parse({
      description     : 'Ship it',
      assignee        : null,
      dueDate         : null,
      sourceSegmentIds: [],
      uncertain       : false
    })).toThrow();
  });

  it('accepts a full window extraction', () => {
    const extraction = windowExtractionSchema.parse({
      summary    : 'Team agreed to ship the Discord bot first.',
      actionItems: [{
        description     : 'Set up the Discord application',
        assignee        : 'Alice',
        dueDate         : null,
        sourceSegmentIds: ['seg-1'],
        uncertain       : false
      }],
      decisions: [{
        description     : 'Discord is the first platform',
        rationale       : 'Only platform with first-class bot support',
        sourceSegmentIds: ['seg-1'],
        uncertain       : false
      }],
      openQuestions: [],
      keyPoints    : []
    });

    expect(extraction.actionItems).toHaveLength(1);
    expect(extraction.decisions[0]?.sourceSegmentIds).toContain('seg-1');
  });
});

describe('artifact content', () => {
  it('parses content narrowed by artifact type', () => {
    const parsed = parseArtifactContent('diagram', {
      mermaid     : 'flowchart TD\n  A --> B',
      nodeEvidence: { A: ['seg-1'] }
    });

    expect(parsed.type).toBe('diagram');
  });

  it('rejects content that does not match the declared type', () => {
    expect(() => parseArtifactContent('summary', { mermaid: 'flowchart TD' })).toThrow();
  });

  it('knows all artifact types', () => {
    expect(artifactTypeSchema.options).toEqual([
      'summary',
      'action-items',
      'decisions',
      'open-questions',
      'key-points',
      'diagram'
    ]);
  });
});

describe('meetingSchema', () => {
  it('round-trips a meeting', () => {
    const meeting = meetingSchema.parse({
      id            : 'meeting-1',
      title         : 'MVP planning',
      platform      : 'discord',
      status        : 'live',
      startedAt     : 1765000000000,
      endedAt       : null,
      externalRef   : 'guild:123/channel:456',
      voiceChannelId: null
    });

    expect(meeting.status).toBe('live');
  });
});
