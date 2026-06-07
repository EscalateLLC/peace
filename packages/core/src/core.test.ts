import { describe, expect, it } from 'vitest';
import {
  actionItemSchema,
  artifactTypeSchema,
  conversationEventSchema,
  meetingSchema,
  parseArtifactContent,
  windowExtractionSchema
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
  source      : 'discord-voice'
};

describe('conversationEventSchema', () => {
  it('round-trips a valid event from every source', () => {
    for (const source of ['discord-voice', 'discord-text', 'transcript-file']) {
      const parsed = conversationEventSchema.parse({
        ...validEvent,
        source
      });

      expect(parsed.source).toBe(source);
    }
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
      id         : 'meeting-1',
      title      : 'MVP planning',
      platform   : 'discord',
      status     : 'live',
      startedAt  : 1765000000000,
      endedAt    : null,
      externalRef: 'guild:123/channel:456'
    });

    expect(meeting.status).toBe('live');
  });
});
