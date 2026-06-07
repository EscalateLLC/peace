import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConversationEvent } from '@peace/core';
import { createDb, createMeeting, getActionItems, getLatestArtifacts, insertSegments, migrate, type PeaceDb } from '@peace/db';
import { extractFromEvents } from './extract';
import { looksLikeMermaidFlowchart } from './diagram';
import { renderWindow, windowEvents } from './windowing';
import { runPipeline } from './run';
import type { StructuredGenerator, StructuredRequest } from './generator';

function makeEvents (count: number, meetingId = 'meeting-1'): ConversationEvent[] {
  return Array.from({ length: count }, (unused, index) => ({
    id          : `seg-${index + 1}`,
    meetingId,
    speakerId   : `user:${index % 2 === 0 ? 'alice' : 'bob'}`,
    speakerLabel: index % 2 === 0 ? 'Alice' : 'Bob',
    text        : `Utterance number ${index + 1} with enough words to carry some weight in the window.`,
    tStart      : index * 2000,
    tEnd        : index * 2000 + 1500,
    confidence  : 1,
    source      : 'transcript-file' as const
  }));
}

/**
 * A fake StructuredGenerator: extraction requests get items citing the first
 * alias plus one bogus alias (exercises evidence validation); the final
 * summary and diagram requests get fixed shapes.
 */
function fakeGenerator (): { generate: StructuredGenerator; calls: StructuredRequest<unknown>[] } {
  const calls: StructuredRequest<unknown>[] = [];
  const generate = (<T, >(request: StructuredRequest<T>): Promise<T> => {
    calls.push(request as StructuredRequest<unknown>);

    if (request.system.includes('diagramming engine')) {
      return Promise.resolve(request.schema.parse({
        title  : 'Test flow',
        mermaid: 'flowchart TD\n  A["Start"] --> B["End"]',
        nodes  : [{
          nodeId  : 'A',
          segments: ['S1']
        }, {
          nodeId  : 'B',
          segments: ['S999']
        }]
      }));
    }

    if (request.system.includes('final meeting summaries')) {
      return Promise.resolve(request.schema.parse({ markdown: 'Final cohesive summary.' }));
    }

    return Promise.resolve(request.schema.parse({
      summary    : 'Window summary.',
      actionItems: [{
        description: 'Do the thing',
        assignee   : 'Alice',
        dueDate    : null,
        segments   : ['S1', 'S999'],
        uncertain  : false
      }],
      decisions: [{
        description: 'We decided',
        rationale  : null,
        segments   : ['S2'],
        uncertain  : false
      }, {
        description: 'Hallucinated decision',
        rationale  : null,
        segments   : ['S999'],
        uncertain  : false
      }],
      openQuestions: [],
      keyPoints    : []
    }));
  }) as StructuredGenerator;

  return {
    generate,
    calls
  };
}

describe('windowing', () => {
  it('splits on size and keeps every segment exactly once', () => {
    const events = makeEvents(120);
    const windows = windowEvents(events, 1000);

    expect(windows.length).toBeGreaterThan(1);

    const ids = windows.flatMap(window => [...window.segmentIds]);

    expect(ids).toHaveLength(events.length);
    expect(new Set(ids).size).toBe(events.length);
  });

  it('renders aliases that map back to real ids', () => {
    const window = windowEvents(makeEvents(3))[0]!;
    const { text, aliasToId } = renderWindow(window);

    expect(text).toContain('[S1]');
    expect(aliasToId.get('S3')).toBe('seg-3');
  });
});

describe('extraction evidence integrity', () => {
  it('maps aliases to ids, drops items with no real evidence', async () => {
    const { generate } = fakeGenerator();
    const merged = await extractFromEvents(makeEvents(4), generate);

    // Action item kept: S1 resolves, bogus S999 ignored.
    expect(merged.actionItems).toHaveLength(1);
    expect(merged.actionItems[0]!.sourceSegmentIds).toEqual(['seg-1']);

    // One decision kept (S2), the hallucinated one (S999 only) dropped.
    expect(merged.decisions).toHaveLength(1);
    expect(merged.stats.droppedItems).toBe(1);
  });

  it('carries window summaries forward as context', async () => {
    const { generate, calls } = fakeGenerator();

    await extractFromEvents(makeEvents(120), generate);

    const extractionCalls = calls.filter(call => call.system.includes('note-taking engine'));

    expect(extractionCalls.length).toBeGreaterThan(1);
    expect(extractionCalls[0]!.prompt).not.toContain('Context from earlier');
    expect(extractionCalls[1]!.prompt).toContain('Context from earlier');
  });
});

describe('mermaid sanity check', () => {
  it('accepts a plain flowchart and rejects junk', () => {
    expect(looksLikeMermaidFlowchart('flowchart TD\n  A["x"] --> B["y"]')).toBe(true);
    expect(looksLikeMermaidFlowchart('sequenceDiagram\n  A->>B: hi')).toBe(false);
    expect(looksLikeMermaidFlowchart('flowchart TD\n  A["x" --> B["y"]')).toBe(false);
    expect(looksLikeMermaidFlowchart('flowchart TD\n  A["x"]')).toBe(false);
  });
});

describe('runPipeline', () => {
  let dir: string;
  let db: PeaceDb;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'peace-pipeline-'));
    db = createDb({ path: join(dir, 'test.db') });
    migrate(db);
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dir, {
      recursive: true,
      force    : true
    });
  });

  it('persists all six artifact types with evidence pointing at real segments', async () => {
    const meeting = createMeeting(db, {
      title    : 'Pipeline test',
      platform : 'upload',
      startedAt: 0
    });
    const events = makeEvents(4, meeting.id);

    insertSegments(db, events);

    const { generate } = fakeGenerator();
    const result = await runPipeline(db, meeting.id, generate, () => 42);

    expect(result.artifacts.map(artifact => artifact.type).sort()).toEqual([
      'action-items',
      'decisions',
      'diagram',
      'key-points',
      'open-questions',
      'summary'
    ]);

    const latest = getLatestArtifacts(db, meeting.id);
    const segmentIds = new Set(events.map(event => event.id));

    expect(latest).toHaveLength(6);

    // Every persisted evidence id must reference a real transcript segment.
    for (const artifact of latest) {
      const content = artifact.content as { items?: { sourceSegmentIds: string[] }[]; nodeEvidence?: Record<string, string[]> };

      for (const item of content.items ?? []) {
        expect(item.sourceSegmentIds.length).toBeGreaterThan(0);
        item.sourceSegmentIds.forEach(id => expect(segmentIds.has(id)).toBe(true));
      }

      Object.values(content.nodeEvidence ?? {}).forEach(ids => ids.forEach(id => expect(segmentIds.has(id)).toBe(true)));
    }

    // Diagram node with only bogus evidence has no nodeEvidence entry.
    const diagram = latest.find(artifact => artifact.type === 'diagram')!;
    const nodeEvidence = (diagram.content as { nodeEvidence: Record<string, string[]> }).nodeEvidence;

    expect(nodeEvidence).toHaveProperty('A');
    expect(nodeEvidence).not.toHaveProperty('B');

    // Current-state table refreshed.
    expect(getActionItems(db, meeting.id)).toHaveLength(1);

    // Regeneration creates version 2, immutably.
    const second = await runPipeline(db, meeting.id, generate, () => 43);

    expect(second.artifacts.find(artifact => artifact.type === 'summary')!.version).toBe(2);
  });

  it('throws on a meeting with no segments', async () => {
    const meeting = createMeeting(db, {
      title    : 'Empty',
      platform : 'upload',
      startedAt: 0
    });
    const { generate } = fakeGenerator();

    await expect(runPipeline(db, meeting.id, generate)).rejects.toThrow(/no transcript segments/u);
  });
});
