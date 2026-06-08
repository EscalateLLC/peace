import type { RouterConfig } from './heuristics';
import type { ConversationState, RouterInput } from './types';

const ENERGY_HALF_LIFE_MS = 15000;
const ENERGY_PER_TURN = 0.25;

export function initialState (now: number): ConversationState {
  return {
    speaking      : new Set<string>(),
    botSpeech     : null,
    lastBotSpokeAt: 0,
    lastAddressed : null,
    socialBudget  : {
      spokenThisWindow: 0,
      windowStart     : now
    },
    energy           : 0,
    lastHumanSpeechAt: 0
  };
}

function decayEnergy (energy: number, dtMs: number): number {
  if (dtMs <= 0) {
    return energy;
  }

  return energy * Math.pow(0.5, dtMs / ENERGY_HALF_LIFE_MS);
}

/** Bump energy for a fresh human turn (decayed since the last one, then +turn). */
function bumpEnergy (state: ConversationState, at: number): number {
  return Math.min(1, decayEnergy(state.energy, at - state.lastHumanSpeechAt) + ENERGY_PER_TURN);
}

/**
 * Fold one input into conversation state (pure). botSpeech start is set
 * imperatively by the engine when it delivers; here it is only CLEARED on the
 * bot's own speech.finished/aborted feedback. lastBotSpokeAt advances only on
 * finished (a registered turn) — never on abort.
 */
export function reduce (state: ConversationState, input: RouterInput): ConversationState {
  switch (input.type) {
    case 'speaker.start': {
      const speaking = new Set(state.speaking);

      speaking.add(input.speaker.speakerId);

      return {
        ...state,
        speaking,
        energy           : bumpEnergy(state, input.at),
        lastHumanSpeechAt: input.at
      };
    }

    case 'speaker.stop': {
      const speaking = new Set(state.speaking);

      speaking.delete(input.speaker.speakerId);

      return {
        ...state,
        speaking,
        lastHumanSpeechAt: Math.max(state.lastHumanSpeechAt, input.at)
      };
    }

    case 'utterance.committed':
      return {
        ...state,
        lastHumanSpeechAt: Math.max(state.lastHumanSpeechAt, input.at)
      };

    case 'speech.finished':
      return {
        ...state,
        botSpeech     : state.botSpeech?.candidateId === input.candidateId ? null : state.botSpeech,
        lastBotSpokeAt: input.at
      };

    case 'speech.aborted':
      return {
        ...state,
        botSpeech: state.botSpeech?.candidateId === input.candidateId ? null : state.botSpeech
      };

    case 'silence.span':
      return state;

    default:
      return state;
  }
}

/**
 * Count an unsolicited (proactive) speak against the rolling social budget,
 * rolling the window over if it has elapsed. Addressed/follow-up replies do
 * not call this — only volunteered speech is budgeted (H5).
 */
export function noteProactiveSpoke (state: ConversationState, now: number, cfg: RouterConfig): ConversationState {
  const rolled = now - state.socialBudget.windowStart > cfg.budgetWindowMs;

  return {
    ...state,
    socialBudget: {
      spokenThisWindow: (rolled ? 0 : state.socialBudget.spokenThisWindow) + 1,
      windowStart     : rolled ? now : state.socialBudget.windowStart
    }
  };
}

/** Roll the budget window forward if elapsed (so availability checks see a fresh window). */
export function rollBudgetWindow (state: ConversationState, now: number, cfg: RouterConfig): ConversationState {
  if (now - state.socialBudget.windowStart <= cfg.budgetWindowMs) {
    return state;
  }

  return {
    ...state,
    socialBudget: {
      spokenThisWindow: 0,
      windowStart     : now
    }
  };
}
