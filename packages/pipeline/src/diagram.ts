import { z } from 'zod';
import type { ConversationEvent } from '@peace/core';
import type { StructuredGenerator } from './generator';
import { renderWindow, type TranscriptWindow } from './windowing';
import type { MergedExtraction } from './extract';

const rawDiagramSchema = z.object({
  title  : z.string().describe('Short diagram title'),
  mermaid: z.string().describe('Valid Mermaid source. Use "flowchart TD". Node labels in double quotes. No styling, no click handlers, no comments.'),
  nodes  : z.array(z.object({
    nodeId  : z.string().describe('The Mermaid node id used in the source'),
    segments: z.array(z.string()).describe('Transcript segment aliases (e.g. ["S3"]) backing this node')
  }))
});

const DIAGRAM_SYSTEM = `You are the diagramming engine of "peace", an AI meeting participant.
From a meeting transcript (lines prefixed with segment aliases like [S3]) and its extracted decisions, produce ONE Mermaid flowchart that captures the main process, system, or decision structure discussed.

Rules:
- Output "flowchart TD" syntax only.
- Wrap every node label in double quotes: A["Label text"].
- Keep it readable: at most ~15 nodes.
- Every node must be listed in "nodes" with the segment aliases that back it. Nodes you cannot ground in the transcript must not appear.
- No styling directives, no subroutine shapes, no click/href.`;

export interface DiagramResult {
  title: string;
  mermaid: string;
  nodeEvidence: Record<string, string[]>;
}

/**
 * Generate the meeting diagram. Mermaid source gets a structural sanity check
 * here (authoritative validation happens at render time in the workspace,
 * which surfaces parse errors with a regenerate affordance — running full
 * mermaid.parse() needs a DOM and is deliberately not a pipeline dependency).
 * One repair retry on a failed check.
 */
export async function generateDiagram (
  window: TranscriptWindow,
  merged: MergedExtraction,
  generate: StructuredGenerator
): Promise<DiagramResult> {
  const { text, aliasToId } = renderWindow(window);
  const prompt = [
    `Decisions:\n${merged.decisions.map(item => `- ${item.description}`).join('\n') || '(none)'}`,
    `Transcript:\n${text}`
  ].join('\n\n');

  let raw = await generate({
    schema: rawDiagramSchema,
    system: DIAGRAM_SYSTEM,
    prompt
  });

  if (!looksLikeMermaidFlowchart(raw.mermaid)) {
    raw = await generate({
      schema: rawDiagramSchema,
      system: DIAGRAM_SYSTEM,
      prompt: `${prompt}\n\nYour previous Mermaid source failed validation:\n${raw.mermaid}\n\nProduce a corrected "flowchart TD" diagram.`
    });

    if (!looksLikeMermaidFlowchart(raw.mermaid)) {
      throw new Error('diagram generation failed mermaid sanity check after retry');
    }
  }

  const nodeEvidence: Record<string, string[]> = {};

  for (const node of raw.nodes) {
    const ids = node.segments
      .map(alias => aliasToId.get(alias.trim().toUpperCase()))
      .filter((id): id is string => id !== undefined);

    if (ids.length > 0) {
      nodeEvidence[node.nodeId] = ids;
    }
  }

  return {
    title  : raw.title,
    mermaid: raw.mermaid.trim(),
    nodeEvidence
  };
}

export function looksLikeMermaidFlowchart (source: string): boolean {
  const trimmed = source.trim();

  if (!(/^(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/u).test(trimmed)) {
    return false;
  }

  // At least one edge, and no obviously broken constructs.
  const hasEdge = trimmed.includes('-->') || trimmed.includes('---');
  const unbalanced = count(trimmed, '[') !== count(trimmed, ']') || count(trimmed, '(') !== count(trimmed, ')');

  return hasEdge && !unbalanced;
}

function count (text: string, char: string): number {
  let total = 0;

  for (const item of text) {
    if (item === char) {
      total += 1;
    }
  }

  return total;
}

/** A whole transcript as one window, for diagram context. */
export function asSingleWindow (events: ConversationEvent[]): TranscriptWindow {
  return {
    events,
    segmentIds: new Set(events.map(event => event.id))
  };
}
