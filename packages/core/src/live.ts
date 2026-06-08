import { z } from 'zod';
import { actionItemSchema, artifactSchema, decisionSchema, keyPointSchema, openQuestionSchema } from './artifacts';
import { conversationEventSchema } from './events';
import { meetingStatusSchema } from './meeting';

/**
 * Live-layer types (phase 2). Everything here is ephemeral wire data layered
 * on top of the batch model — committed segments are ConversationEvents and
 * committed artifacts are immutable versions, exactly as in MVP1, just sooner.
 * Nothing in this file is ever persisted.
 */

/**
 * A revisable, in-flight utterance from streaming STT. Deliberately NOT a
 * variant of ConversationEvent: interims carry no id/confidence/tEnd, never
 * touch SQLite, and are replaced wholesale by the next interim or the
 * committed segment (latest-wins, one slot per speaker).
 */
export const interimSegmentSchema = z.object({
  meetingId   : z.string().min(1),
  speakerId   : z.string().min(1),
  speakerLabel: z.string().min(1),
  text        : z.string().min(1)
});

export type InterimSegment = z.infer<typeof interimSegmentSchema>;

/**
 * The provisional artifact layer from incremental analysis: latest-wins,
 * unversioned, wire-only. Items reuse the evidence-bearing schemas — the
 * evidence rule is unchanged: provisional items cite only segment ids that
 * are already committed.
 */
export const provisionalExtractionSchema = z.object({
  meetingId    : z.string().min(1),
  actionItems  : z.array(actionItemSchema),
  decisions    : z.array(decisionSchema),
  openQuestions: z.array(openQuestionSchema),
  keyPoints    : z.array(keyPointSchema)
});

export type ProvisionalExtraction = z.infer<typeof provisionalExtractionSchema>;

export const meetingStatusDeltaSchema = z.object({
  meetingId: z.string().min(1),
  status   : meetingStatusSchema
});

export type MeetingStatusDelta = z.infer<typeof meetingStatusDeltaSchema>;

/**
 * An ephemeral operational notice — "voice service failed", "switched to backup
 * voice". Unlike segments/artifacts/status it is NOT workspace truth: it carries
 * no DB row and is not in the snapshot, so it is the one documented exception to
 * lossless polling (a client that missed the push never sees it, by design —
 * it's a transient signal, not state). `at` lets the UI time/auto-dismiss it.
 */
export const meetingNoticeSchema = z.object({
  meetingId: z.string().min(1),
  severity : z.enum(['info', 'warning', 'error']),
  code     : z.string().min(1),
  message  : z.string().min(1),
  at       : z.number().int()
    .nonnegative()
});

export type MeetingNotice = z.infer<typeof meetingNoticeSchema>;

/**
 * The transport envelope pushed from the live session to workspace clients.
 * Committed deltas carry a per-meeting monotonic `seq` — the catch-up key for
 * lossless reconnect/polling replay from SQLite. Interim/provisional/notice
 * deltas are unsequenced: they are ephemeral and latest-wins, so a dropped one
 * is superseded, never missed.
 */
export const workspaceDeltaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('segment.committed'),
    seq : z.number().int()
      .nonnegative(),
    payload: conversationEventSchema
  }),
  z.object({
    type   : z.literal('segment.interim'),
    payload: interimSegmentSchema
  }),
  z.object({
    type   : z.literal('artifact.provisional'),
    payload: provisionalExtractionSchema
  }),
  z.object({
    type: z.literal('artifact.committed'),
    seq : z.number().int()
      .nonnegative(),
    payload: artifactSchema
  }),
  z.object({
    type: z.literal('meeting.status'),
    seq : z.number().int()
      .nonnegative(),
    payload: meetingStatusDeltaSchema
  }),
  z.object({
    type   : z.literal('meeting.notice'),
    payload: meetingNoticeSchema
  })
]);

export type WorkspaceDelta = z.infer<typeof workspaceDeltaSchema>;

// ─── WS wire protocol (shared by the transport server and browser clients) ───

/** Client → server: manage per-meeting subscriptions over one connection. */
export const wsClientMessageSchema = z.object({
  v        : z.literal(1),
  subscribe: z.string().min(1)
    .optional(),
  unsubscribe: z.string().min(1)
    .optional(),

  /** Last committed seq the client applied; the server reports current seq so the client can decide to resync. */
  lastSeq: z.number().int()
    .nonnegative()
    .optional()
});

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

/**
 * Server → client. After `subscribed`, the client takes one snapshot
 * (`getWorkspace`) and applies deltas from there — SQLite is the source of
 * truth, so snapshot-then-stream is lossless by construction.
 */
export const wsServerMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind     : z.literal('subscribed'),
    v        : z.literal(1),
    meetingId: z.string().min(1),
    seq      : z.number().int()
      .nonnegative()
  }),
  z.object({
    kind : z.literal('delta'),
    v    : z.literal(1),
    delta: workspaceDeltaSchema
  })
]);

export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;
