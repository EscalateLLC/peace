import { generateText, stepCountIs, type LanguageModel } from 'ai';
import type { ConversationEvent } from '@peace/core';
import { getSegments, type PeaceDb } from '@peace/db';
import { errorFields, type Logger } from '@peace/logger';
import { renderConversation } from './render';
import { RESPONDER_SYSTEM } from './system-prompt';
import { buildTools } from './tools';

/** Safety bound on the read-tool loop; the model normally ends well before this. */
const MAX_STEPS = 6;

export type ResponseDecision =
  | { kind: 'speak'; text: string; postToChat: boolean }
  | { kind: 'silent'; reason: string }
  | { kind: 'leave'; goodbye: string };

export interface TerminalCall {
  toolName: string;
  input: unknown;
}

/**
 * Pure decision extraction from the loop's tool calls + any plain text. A
 * terminal `respond`/`stay_silent` wins; otherwise non-empty text is treated as
 * a spoken reply; otherwise silence. Separated out so the branching is testable
 * without a live model.
 */
export function pickDecision (calls: TerminalCall[], text: string): ResponseDecision {
  // A leave decision wins outright — honoring "please go" beats anything else.
  const leaveCall = calls.find(call => call.toolName === 'leave_call');

  if (leaveCall) {
    return {
      kind   : 'leave',
      goodbye: (leaveCall.input as { goodbye?: string }).goodbye?.trim() ?? ''
    };
  }

  const respondCall = calls.find(call => call.toolName === 'respond');

  if (respondCall) {
    const { text: said, postToChatToo } = respondCall.input as { text: string; postToChatToo?: boolean };

    return {
      kind      : 'speak',
      text      : said,
      postToChat: Boolean(postToChatToo)
    };
  }

  const silentCall = calls.find(call => call.toolName === 'stay_silent');

  if (silentCall) {
    return {
      kind  : 'silent',
      reason: (silentCall.input as { reason: string }).reason
    };
  }

  if (text.trim().length > 0) {
    return {
      kind      : 'speak',
      text      : text.trim(),
      postToChat: false
    };
  }

  return {
    kind  : 'silent',
    reason: 'no terminal decision'
  };
}

export type DraftMode = 'addressed' | 'follow-up' | 'prompted' | 'proactive';

export interface DraftResponseInput {
  db: PeaceDb;
  meetingId: string;
  model: LanguageModel;

  /** Display name of whoever addressed the bot; null when volunteering (proactive). */
  addressedBy: string | null;

  /** The text after the wake word (may be empty for a bare "peace?"). */
  query: string;

  /** Why the agent is being consulted — tunes how reticent it should be. */
  mode?: DraftMode;

  /** Current operational state to make the agent self-aware (e.g. "you're on backup voice"). */
  operationalNote?: string;
  log: Logger;

  /** Override the transcript (tests); otherwise fetched from the DB. */
  events?: ConversationEvent[];
}

function modeInstruction (mode: DraftMode, addressedBy: string | null, query: string): string {
  switch (mode) {
    case 'proactive':
      return 'No one addressed you directly — you are deciding whether to volunteer a thought. Only respond if you have something genuinely valuable and timely to add right now; otherwise stay_silent. Err strongly toward silence.';

    case 'prompted':
      return 'No one said your name, but the conversation seems to be waiting on you — a question went unanswered, or someone handed off and paused. If you can genuinely help, respond now; if it turns out they were not looking to you, stay_silent.';

    case 'follow-up':
      return `${addressedBy ?? 'Someone'} said: "${query}". This may be a follow-up to what you just said. If it's directed at you and you can help, respond; if it's really aimed at someone else, stay_silent.`;

    default:
      return query ? `${addressedBy ?? 'Someone'} just addressed you: "${query}"` : `${addressedBy ?? 'Someone'} just said your name (no specific question).`;
  }
}

/**
 * Draft what peace should say (or whether to stay silent) in response to being
 * addressed. The responder service the router/01 open question gestures at: a
 * bounded tool-calling loop over read-only context, ending in a terminal
 * `respond`/`stay_silent` decision. Never throws — a failure resolves to
 * silence so a bad LLM call never crashes the meeting.
 */
export async function draftResponse (input: DraftResponseInput): Promise<ResponseDecision> {
  const { db, meetingId, model, addressedBy, query, log } = input;
  const events = input.events ?? getSegments(db, meetingId);
  const transcript = renderConversation(events);
  const startedAt = Date.now();
  const toolsUsed: string[] = [];
  const tools = buildTools(db, meetingId, name => {
    toolsUsed.push(name);
    log.debug('agent.tool_call', {
      meetingId,
      tool: name
    });
  });

  const mode = input.mode ?? 'addressed';
  const prompt = [
    'Recent conversation:',
    transcript || '(nothing has been said yet)',
    '',
    input.operationalNote ? `Operational note: ${input.operationalNote}\n` : '',
    modeInstruction(mode, addressedBy, query),
    'Decide how to respond, then call respond, stay_silent, or leave_call.'
  ].filter(Boolean)
    .join('\n');

  log.info('agent.drafting', {
    meetingId,
    addressedBy,
    mode,
    chars: query.length
  });

  try {
    const result = await generateText({
      model,
      system  : RESPONDER_SYSTEM,
      prompt,
      tools,
      stopWhen: stepCountIs(MAX_STEPS)
    });

    const calls = result.steps.flatMap(step => step.toolCalls.map(call => ({
      toolName: call.toolName,
      input   : call.input
    })));
    const decision = pickDecision(calls, result.text);
    const ms = Date.now() - startedAt;

    if (decision.kind === 'speak') {
      log.info('agent.responded', {
        meetingId,
        chars  : decision.text.length,
        preview: decision.text.slice(0, 140), // a preview (not the full turn) — enough to correlate logs to what was heard
        steps  : result.steps.length,
        tools  : toolsUsed,
        ms
      });
    } else if (decision.kind === 'leave') {
      log.info('agent.leaving', {
        meetingId,
        hasGoodbye: decision.goodbye.length > 0,
        ms
      });
    } else {
      log.info('agent.stayed_silent', {
        meetingId,
        reason: decision.reason,
        ms
      });
    }

    return decision;
  } catch (error) {
    log.error('agent.error', {
      meetingId,
      ...errorFields(error)
    });

    return {
      kind  : 'silent',
      reason: 'error'
    };
  }
}
