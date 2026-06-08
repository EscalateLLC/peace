import { tool } from 'ai';
import { z } from 'zod';
import { parseArtifactContent, type ArtifactType } from '@peace/core';
import { getActionItems, getDecisions, getLatestArtifacts, getSegments, type PeaceDb } from '@peace/db';

/** A read-tool invocation, surfaced to the responder for logging. */
export type ToolCapture = (name: string, input: unknown) => void;

const SEARCH_LIMIT = 12;

// ─── Read helpers (pure DB reads; exported for unit tests) ───────────────────

export function readDecisions (db: PeaceDb, meetingId: string) {
  return getDecisions(db, meetingId).map(decision => ({
    description: decision.description,
    rationale  : decision.rationale
  }));
}

export function readActionItems (db: PeaceDb, meetingId: string) {
  return getActionItems(db, meetingId).map(item => ({
    description: item.description,
    assignee   : item.assignee,
    dueDate    : item.dueDate,
    status     : item.status
  }));
}

function readArtifactItems (db: PeaceDb, meetingId: string, type: ArtifactType): unknown {
  const artifact = getLatestArtifacts(db, meetingId).find(item => item.type === type);

  if (!artifact) {
    return null;
  }

  return parseArtifactContent(type, artifact.content).content;
}

export function readSummary (db: PeaceDb, meetingId: string): string | null {
  const content = readArtifactItems(db, meetingId, 'summary') as { markdown?: string } | null;

  return content?.markdown ?? null;
}

export function searchTranscript (db: PeaceDb, meetingId: string, query: string) {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [];
  }

  return getSegments(db, meetingId)
    .filter(segment => segment.text.toLowerCase().includes(needle))
    .slice(-SEARCH_LIMIT)
    .map(segment => ({
      speaker: segment.speakerLabel,
      text   : segment.text
    }));
}

// ─── Tool set ────────────────────────────────────────────────────────────────

/**
 * Read tools auto-execute and feed results back into the loop; the two terminal
 * tools (`respond`, `stay_silent`) deliberately have NO execute, so the model
 * calling one halts the loop and the responder reads the decision off it. This
 * is the output contract — enforced by shape, not by parsing prose.
 */
export function buildTools (db: PeaceDb, meetingId: string, capture: ToolCapture) {
  const read = <T>(name: string, run: () => T) => () => {
    capture(name, {});

    return Promise.resolve(run() as object);
  };

  return {
    get_decisions: tool({
      description: 'List the decisions the group has settled on so far.',
      inputSchema: z.object({}),
      execute    : read('get_decisions', () => ({ decisions: readDecisions(db, meetingId) }))
    }),
    get_action_items: tool({
      description: 'List the action items / tasks captured so far, with assignees.',
      inputSchema: z.object({}),
      execute    : read('get_action_items', () => ({ actionItems: readActionItems(db, meetingId) }))
    }),
    get_summary: tool({
      description: 'Get the latest running summary of the meeting, if one exists.',
      inputSchema: z.object({}),
      execute    : read('get_summary', () => ({ summary: readSummary(db, meetingId) }))
    }),
    get_open_questions: tool({
      description: 'List unresolved/open questions raised in the meeting.',
      inputSchema: z.object({}),
      execute    : read('get_open_questions', () => ({ openQuestions: readArtifactItems(db, meetingId, 'open-questions') }))
    }),
    get_key_points: tool({
      description: 'List notable facts, constraints, or risks captured so far.',
      inputSchema: z.object({}),
      execute    : read('get_key_points', () => ({ keyPoints: readArtifactItems(db, meetingId, 'key-points') }))
    }),
    search_transcript: tool({
      description: 'Find transcript lines containing a keyword/phrase (case-insensitive). Use for specific or older details.',
      inputSchema: z.object({ query: z.string().describe('Keyword or short phrase to search for') }),
      execute    : ({ query }: { query: string }) => {
        capture('search_transcript', { query });

        return Promise.resolve({ matches: searchTranscript(db, meetingId, query) });
      }
    }),

    // Terminal — no execute → calling one ends the loop.
    respond: tool({
      description: 'Say this back to the group. Phrase it for speech (plain text, no markdown or bullet lists), brief.',
      inputSchema: z.object({
        text         : z.string().describe('What to say, already phrased for speaking aloud'),
        postToChatToo: z.boolean().optional()
          .describe('Also post the text in the chat channel (for reference material better read than heard)')
      })
    }),
    stay_silent: tool({
      description: 'Choose to say nothing — nothing useful to add, or only mentioned in passing.',
      inputSchema: z.object({ reason: z.string().describe('Why staying silent (for tuning/observability)') })
    }),
    leave_call: tool({
      description: 'Leave the call / end your participation. Call this when the participants clearly want you to go ("you can leave now", "head out", "we\'re done with you"). You CAN do this — never claim you cannot.',
      inputSchema: z.object({
        goodbye: z.string().optional()
          .describe('A brief spoken sign-off to say before leaving (plain speech). Optional.')
      })
    })
  };
}
