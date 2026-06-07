import type { Artifact } from '@peace/core';
import {
  getSegments,
  insertArtifact,
  replaceActionItems,
  replaceDecisions,
  type PeaceDb
} from '@peace/db';
import type { StructuredGenerator } from './generator';
import { extractFromEvents, generateFinalSummary, type MergedExtraction } from './extract';
import { asSingleWindow, generateDiagram } from './diagram';

export interface PipelineRunResult {
  artifacts: Artifact[];
  extraction: MergedExtraction;
}

/**
 * The full pipeline over a persisted meeting: load segments → windowed
 * extraction → final summary + diagram → persist as new artifact versions
 * (immutable) + refresh the current-state action item / decision tables.
 */
export async function runPipeline (db: PeaceDb, meetingId: string, generate: StructuredGenerator, now: () => number = Date.now): Promise<PipelineRunResult> {
  const events = getSegments(db, meetingId);

  if (events.length === 0) {
    throw new Error(`meeting ${meetingId} has no transcript segments`);
  }

  const extraction = await extractFromEvents(events, generate);
  const summaryMarkdown = await generateFinalSummary(extraction, generate);
  const diagram = await generateDiagram(asSingleWindow(events), extraction, generate);
  const createdAt = now();

  const artifacts: Artifact[] = [
    insertArtifact(db, {
      meetingId,
      type   : 'summary',
      title  : 'Summary',
      content: {
        markdown        : summaryMarkdown,
        sourceSegmentIds: []
      },
      createdAt
    }),
    insertArtifact(db, {
      meetingId,
      type   : 'action-items',
      title  : 'Action items',
      content: { items: extraction.actionItems },
      createdAt
    }),
    insertArtifact(db, {
      meetingId,
      type   : 'decisions',
      title  : 'Decisions',
      content: { items: extraction.decisions },
      createdAt
    }),
    insertArtifact(db, {
      meetingId,
      type   : 'open-questions',
      title  : 'Open questions',
      content: { items: extraction.openQuestions },
      createdAt
    }),
    insertArtifact(db, {
      meetingId,
      type   : 'key-points',
      title  : 'Key points',
      content: { items: extraction.keyPoints },
      createdAt
    }),
    insertArtifact(db, {
      meetingId,
      type   : 'diagram',
      title  : diagram.title,
      content: {
        mermaid     : diagram.mermaid,
        nodeEvidence: diagram.nodeEvidence
      },
      createdAt
    })
  ];

  replaceActionItems(db, meetingId, extraction.actionItems);
  replaceDecisions(db, meetingId, extraction.decisions, createdAt);

  return {
    artifacts,
    extraction
  };
}
