import { z } from 'zod';
import type { ConversationEvent, WindowExtraction } from '@peace/core';
import type { StructuredGenerator } from './generator';
import { renderWindow, windowEvents, type TranscriptWindow } from './windowing';

/**
 * What the model returns: items cite segment ALIASES (S1, S2, ...) which we
 * map back to real segment ids. Items whose citations don't resolve to real
 * segments in the window are dropped — unsupported claims never persist.
 */
const rawEvidence = {
  segments : z.array(z.string()).describe('Aliases of the transcript segments (e.g. ["S3","S4"]) this item is directly grounded in. Required.'),
  uncertain: z.boolean().describe('true if the transcript only weakly supports this item')
};

const rawExtractionSchema = z.object({
  summary: z.string().describe('Dense factual summary of THIS window, a short paragraph. Written so it can serve as context for reading the next part of the transcript.'),

  actionItems: z.array(z.object({
    description: z.string().describe('The task, phrased as an imperative'),
    assignee   : z.string().nullable()
      .describe('Who owns it, exactly as named in the transcript, or null'),
    dueDate: z.string().nullable()
      .describe('Due date/time expression as stated (e.g. "Friday", "next Wednesday"), or null'),
    ...rawEvidence
  })),

  decisions: z.array(z.object({
    description: z.string().describe('What was decided, as a statement of fact'),
    rationale  : z.string().nullable()
      .describe('Why, if stated'),
    ...rawEvidence
  })),

  openQuestions: z.array(z.object({
    question: z.string().describe('A question raised but not resolved in this window'),
    ...rawEvidence
  })),

  keyPoints: z.array(z.object({
    point: z.string().describe('A notable fact, constraint, or risk worth remembering'),
    ...rawEvidence
  }))
});

const EXTRACTION_SYSTEM = `You are the note-taking engine of "peace", an AI meeting participant.
You receive one window of a meeting transcript. Each line is prefixed with a segment alias like [S3].

Extract ONLY what the transcript explicitly supports:
- actionItems: concrete tasks someone committed to or was assigned.
- decisions: choices the group settled on (not proposals still under discussion).
- openQuestions: questions raised but left unresolved.
- keyPoints: notable facts, constraints, risks, or numbers.

Rules:
- Every item MUST cite the alias(es) of the segment(s) it came from in "segments". An item you cannot ground in specific segments must not be emitted.
- Set "uncertain": true when support is implicit or ambiguous.
- Do not invent assignees, dates, or rationale that were not stated.
- An empty array is the correct output when a window contains nothing of that kind.`;

export interface ExtractionStats {
  windows: number;
  droppedItems: number;
}

export interface MergedExtraction extends WindowExtraction {
  stats: ExtractionStats;
}

/**
 * Run windowed extraction over a whole transcript: sequential windows with a
 * running summary as carried context, alias→id mapping, and evidence
 * validation (items citing no real segment in their window are dropped).
 */
export async function extractFromEvents (events: ConversationEvent[], generate: StructuredGenerator): Promise<MergedExtraction> {
  const windows = windowEvents(events);
  const merged: MergedExtraction = {
    summary      : '',
    actionItems  : [],
    decisions    : [],
    openQuestions: [],
    keyPoints    : [],
    stats        : {
      windows     : windows.length,
      droppedItems: 0
    }
  };
  const windowSummaries: string[] = [];

  for (const window of windows) {
    const { text, aliasToId } = renderWindow(window);
    const context = windowSummaries.length > 0 ? `Context from earlier in the meeting:\n${windowSummaries.join('\n')}\n\n` : '';
    const raw = await generate({
      schema: rawExtractionSchema,
      system: EXTRACTION_SYSTEM,
      prompt: `${context}Transcript window:\n${text}`
    });

    windowSummaries.push(raw.summary);
    mergeWindow(merged, raw, aliasToId, window);
  }

  merged.summary = windowSummaries.join('\n\n');

  return merged;
}

type RawExtraction = z.infer<typeof rawExtractionSchema>;

function mergeWindow (merged: MergedExtraction, raw: RawExtraction, aliasToId: Map<string, string>, window: TranscriptWindow): void {
  const resolve = (aliases: string[]): string[] => aliases
    .map(alias => aliasToId.get(alias.trim().toUpperCase()))
    .filter((id): id is string => id !== undefined && window.segmentIds.has(id));

  const keep = <T extends { segments: string[]; uncertain: boolean }, U>(
    items: T[],
    build: (item: T, sourceSegmentIds: string[]) => U
  ): U[] => {
    const kept: U[] = [];

    for (const item of items) {
      const sourceSegmentIds = resolve(item.segments);

      if (sourceSegmentIds.length === 0) {
        merged.stats.droppedItems += 1;
        continue;
      }

      kept.push(build(item, sourceSegmentIds));
    }

    return kept;
  };

  merged.actionItems.push(...keep(raw.actionItems, (item, sourceSegmentIds) => ({
    description: item.description,
    assignee   : item.assignee,
    dueDate    : item.dueDate,
    sourceSegmentIds,
    uncertain  : item.uncertain
  })));
  merged.decisions.push(...keep(raw.decisions, (item, sourceSegmentIds) => ({
    description: item.description,
    rationale  : item.rationale,
    sourceSegmentIds,
    uncertain  : item.uncertain
  })));
  merged.openQuestions.push(...keep(raw.openQuestions, (item, sourceSegmentIds) => ({
    question : item.question,
    sourceSegmentIds,
    uncertain: item.uncertain
  })));
  merged.keyPoints.push(...keep(raw.keyPoints, (item, sourceSegmentIds) => ({
    point    : item.point,
    sourceSegmentIds,
    uncertain: item.uncertain
  })));
}

const summarySchema = z.object({
  markdown: z.string().min(1)
    .describe('A crisp meeting summary in markdown: 1 short opening paragraph, then bullet sections as warranted. No heading at the top.')
});

/** Final cohesive summary across all windows (single window passes through cheaply). */
export async function generateFinalSummary (merged: MergedExtraction, generate: StructuredGenerator): Promise<string> {
  if (merged.stats.windows <= 1) {
    return merged.summary;
  }

  const { markdown } = await generate({
    schema: summarySchema,
    system: 'You write final meeting summaries for "peace". You receive sequential window summaries of one meeting plus its extracted decisions and action items. Produce one cohesive summary; do not invent anything not present in the input.',
    prompt: [
      `Window summaries:\n${merged.summary}`,
      `Decisions:\n${merged.decisions.map(item => `- ${item.description}`).join('\n') || '(none)'}`,
      `Action items:\n${merged.actionItems.map(item => `- ${item.description}${item.assignee ? ` (${item.assignee})` : ''}`).join('\n') || '(none)'}`
    ].join('\n\n')
  });

  return markdown;
}
