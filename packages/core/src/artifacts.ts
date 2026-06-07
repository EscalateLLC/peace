import { z } from 'zod';

/**
 * Evidence linking is the product differentiator and is enforced here, in the
 * schema layer: every extracted item MUST cite at least one source segment.
 * The pipeline additionally validates that the cited ids exist.
 */
export const evidenceSchema = z.object({
  /** Transcript segment ids (ConversationEvent ids) this item is grounded in. */
  sourceSegmentIds: z.array(z.string().min(1)).min(1),

  /** Model self-reported uncertainty; uncertain items are flagged in the UI. */
  uncertain: z.boolean()
});

export const actionItemSchema = evidenceSchema.extend({
  description: z.string().min(1),
  assignee   : z.string().nullable(),

  /** ISO date if one was stated in conversation. */
  dueDate: z.string().nullable()
});

export type ActionItem = z.infer<typeof actionItemSchema>;

export const decisionSchema = evidenceSchema.extend({
  description: z.string().min(1),
  rationale  : z.string().nullable()
});

export type Decision = z.infer<typeof decisionSchema>;

export const openQuestionSchema = evidenceSchema.extend({ question: z.string().min(1) });

export type OpenQuestion = z.infer<typeof openQuestionSchema>;

export const keyPointSchema = evidenceSchema.extend({ point: z.string().min(1) });

export type KeyPoint = z.infer<typeof keyPointSchema>;

/**
 * What one structured-extraction call over a transcript window returns.
 * Arrays may be empty — a window can contain nothing worth extracting.
 */
export const windowExtractionSchema = z.object({
  /** Running summary of the window, used as context for the next window. */
  summary      : z.string(),
  actionItems  : z.array(actionItemSchema),
  decisions    : z.array(decisionSchema),
  openQuestions: z.array(openQuestionSchema),
  keyPoints    : z.array(keyPointSchema)
});

export type WindowExtraction = z.infer<typeof windowExtractionSchema>;

// ─── Artifacts (persisted, immutable versions) ───────────────────────────────

export const artifactTypeSchema = z.enum([
  'summary',
  'action-items',
  'decisions',
  'open-questions',
  'key-points',
  'diagram'
]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const summaryContentSchema = z.object({
  markdown        : z.string().min(1),
  sourceSegmentIds: z.array(z.string().min(1))
});

export const diagramContentSchema = z.object({
  /** Validated Mermaid source (mermaid.parse passed before persisting). */
  mermaid: z.string().min(1),

  /** Diagram node id → transcript segment ids backing that node. */
  nodeEvidence: z.record(z.string(), z.array(z.string().min(1)))
});

export const artifactContentSchema = z.discriminatedUnion('type', [
  z.object({
    type   : z.literal('summary'),
    content: summaryContentSchema
  }),
  z.object({
    type   : z.literal('action-items'),
    content: z.object({ items: z.array(actionItemSchema) })
  }),
  z.object({
    type   : z.literal('decisions'),
    content: z.object({ items: z.array(decisionSchema) })
  }),
  z.object({
    type   : z.literal('open-questions'),
    content: z.object({ items: z.array(openQuestionSchema) })
  }),
  z.object({
    type   : z.literal('key-points'),
    content: z.object({ items: z.array(keyPointSchema) })
  }),
  z.object({
    type   : z.literal('diagram'),
    content: diagramContentSchema
  })
]);

export type ArtifactContent = z.infer<typeof artifactContentSchema>;

/**
 * A persisted artifact version. Regeneration inserts a new row with
 * version + 1 — versions are immutable.
 */
export const artifactSchema = z.object({
  id       : z.string().min(1),
  meetingId: z.string().min(1),
  type     : artifactTypeSchema,
  title    : z.string().min(1),

  /** Discriminated by `type`; see artifactContentSchema. */
  content: z.unknown(),
  version: z.number().int()
    .positive(),
  createdAt: z.number().nonnegative()
});

export type Artifact = z.infer<typeof artifactSchema>;

/** Parse + narrow an artifact's content against its declared type. */
export function parseArtifactContent (type: ArtifactType, content: unknown): ArtifactContent {
  return artifactContentSchema.parse({
    type,
    content
  });
}
