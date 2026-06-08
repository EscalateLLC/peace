import { parseSpeakerId } from '@peace/core';
import type { Logger } from '@peace/logger';
import {
  DEFAULT_CONFIG,
  budgetAvailable,
  classifyAddress,
  energyLevel,
  isInterruptCue,
  isStale,
  looksLikeTurnYield,
  type RouterConfig
} from './heuristics';
import { evaluateWaitingExpectancy } from './expectancy';
import { initialState, noteProactiveSpoke, reduce, rollBudgetWindow } from './state';
import type { Candidate, CandidateKind, DraftFn, RouterExecutor, RouterInput, SpeechHandle } from './types';

const CLOCK_INTERVAL_MS = 1000;

/** If neither speech.finished nor speech.aborted arrives, force-resolve (discard). */
const FINISH_TIMEOUT_MS = 60000;

export interface ParticipationRouterDeps {
  meetingId: string;
  draft: DraftFn;
  executor: RouterExecutor;
  log: Logger;
  config?: Partial<RouterConfig>;

  /** Injectable wall clock (tests). */
  now?: () => number;
}

export interface ParticipationRouter {
  submit: (input: RouterInput) => void;

  /** Begin the silence clock (proactive lulls). Tests can drive submit() directly instead. */
  start: () => void;
  stop: () => void;
}

/**
 * The participation engine (router/06): watch → nominate → draft → gate →
 * register. The register-or-discard invariant is absolute — a turn touches
 * history (executor.registerTurn) ONLY when speech.finished confirms it was
 * delivered. Drafts that are barged-in, stale, or floor-blocked leave no trace.
 */
export function createParticipationRouter (deps: ParticipationRouterDeps): ParticipationRouter {
  const cfg: RouterConfig = {
    ...DEFAULT_CONFIG,
    ...deps.config
  };
  const clock = deps.now ?? Date.now;
  let state = initialState(clock());
  let candidateSeq = 0;
  let activeDraft = false;
  let inFlight: { candidate: Candidate; handle: SpeechHandle } | null = null;
  let lastProactiveDraftAt = 0;
  let lastExpectancyAt = -Infinity; // -Infinity so the first nudge is never cooldown-suppressed
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;

  function makeCandidate (kind: CandidateKind, addressedBy: Candidate['addressedBy'], query: string, now: number): Candidate {
    candidateSeq++;
    const ttl = kind === 'proactive' ? cfg.proactiveTtlMs : cfg.candidateTtlMs;

    return {
      id       : `cand-${candidateSeq}`,
      kind,
      addressedBy,
      query,
      createdAt: now,
      expiresAt: now + ttl
    };
  }

  function clearFinishTimer (): void {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
  }

  function bargeIn (reason: string): void {
    if (!inFlight) {
      return;
    }

    deps.executor.abortSpeech(inFlight.handle, reason);
    deps.log.info('router.barge_in_aborted', {
      meetingId  : deps.meetingId,
      candidateId: inFlight.candidate.id,
      reason
    });
    inFlight = null;
    state.botSpeech = null;
    clearFinishTimer();
  }

  function registerOrDiscard (candidateId: string, registered: boolean): void {
    if (!inFlight || inFlight.candidate.id !== candidateId) {
      return;
    }

    const { candidate } = inFlight;

    if (registered) {
      deps.executor.registerTurn(candidate);

      if (candidate.kind === 'proactive') {
        state = noteProactiveSpoke(state, clock(), cfg);
      }

      deps.log.info('router.registered', {
        meetingId: deps.meetingId,
        candidateId,
        kind     : candidate.kind
      });
    }

    inFlight = null;
    clearFinishTimer();
  }

  async function runCandidate (candidate: Candidate): Promise<void> {
    activeDraft = true;
    deps.log.info('router.nominated', {
      meetingId  : deps.meetingId,
      candidateId: candidate.id,
      kind       : candidate.kind
    });

    try {
      const outcome = await deps.draft({
        mode       : candidate.kind,
        addressedBy: candidate.addressedBy?.speakerLabel ?? null,
        query      : candidate.query
      });

      if (outcome.kind === 'silent') {
        deps.log.info('router.silent', {
          meetingId  : deps.meetingId,
          candidateId: candidate.id,
          reason     : outcome.reason
        });

        return;
      }

      candidate.text = outcome.text;

      // GATE — re-validate against CURRENT state (same blocking mechanics for every candidate).
      const now = clock();
      const discard = (reason: string) => deps.log.info('router.gated', {
        meetingId  : deps.meetingId,
        candidateId: candidate.id,
        verdict    : 'discarded',
        reason
      });

      if (!deps.executor.isInVoice()) {
        discard('not-in-voice');

        return;
      }

      if (isStale(candidate, now)) {
        discard('stale');

        return;
      }

      if (state.speaking.size > 0) {
        discard('floor-held');

        return;
      }

      if (inFlight || state.botSpeech) {
        discard('bot-busy');

        return;
      }

      if (candidate.kind === 'proactive' && !budgetAvailable(rollBudgetWindow(state, now, cfg), cfg)) {
        discard('budget');

        return;
      }

      // DELIVER. The executor owns user-facing degradation (it falls back to
      // text and surfaces a notice); a throw here means voice was NOT delivered,
      // so we record it distinctly and leave nothing in flight.
      let handle: SpeechHandle;

      try {
        handle = await deps.executor.speak(candidate);
      } catch (error) {
        deps.log.error('router.speak_failed', {
          meetingId  : deps.meetingId,
          candidateId: candidate.id,
          error      : error instanceof Error ? error.message : String(error)
        });

        return;
      }

      inFlight = {
        candidate,
        handle
      };
      state.botSpeech = {
        candidateId: candidate.id,
        startedAt  : now
      };
      deps.log.info('router.gated', {
        meetingId  : deps.meetingId,
        candidateId: candidate.id,
        verdict    : 'delivered',
        kind       : candidate.kind
      });

      finishTimer = setTimeout(() => {
        deps.log.warn('router.finish_timeout', {
          meetingId  : deps.meetingId,
          candidateId: candidate.id
        });
        registerOrDiscard(candidate.id, false);
      }, FINISH_TIMEOUT_MS);
    } catch (error) {
      deps.log.error('router.draft_error', {
        meetingId  : deps.meetingId,
        candidateId: candidate.id,
        error      : error instanceof Error ? error.message : String(error)
      });
    } finally {
      activeDraft = false;
    }
  }

  function maybeNominate (candidate: Candidate): void {
    // One draft and one delivery at a time; while busy, drop (the human can
    // re-ask, and barge-in already clears stale bot speech).
    if (activeDraft || inFlight) {
      deps.log.debug('router.nominate_skipped', {
        meetingId  : deps.meetingId,
        candidateId: candidate.id,
        reason     : activeDraft ? 'drafting' : 'speaking'
      });

      return;
    }

    runCandidate(candidate).catch(() => undefined);
  }

  function onUtterance (input: Extract<RouterInput, { type: 'utterance.committed' }>): void {
    // Never react to the bot's own (registered) turns.
    if (parseSpeakerIdSafe(input.event.speakerId) === 'peace') {
      return;
    }

    const verdict = classifyAddress(input.event.text, input.at, state.lastBotSpokeAt, cfg);

    // Content-aware barge-in: while the bot is speaking, cut it off ONLY when a
    // human has a reason to — they address it ("peace, …") or signal an
    // interruption ("wait", "hold on", "stop"). Otherwise it finishes its turn;
    // we don't yield the floor just because someone else made a sound. (An
    // addressed utterance then falls through to nominate the redirected reply.)
    if (inFlight && (verdict.kind === 'addressed' || isInterruptCue(input.event.text))) {
      bargeIn('interrupted');
    }

    if (!verdict.kind) {
      // Expectancy (turn-yield): a hand-off to peace with no wake word
      // ("…so, thoughts?") while it's recently engaged → the helper taps it.
      if (recentlyEngaged(input.at) && looksLikeTurnYield(input.event.text)) {
        maybeNominate(makeCandidate('prompted', {
          speakerId   : input.event.speakerId,
          speakerLabel: input.event.speakerLabel
        }, input.event.text.trim(), input.at));
      }

      return;
    }

    state.lastAddressed = {
      speakerId: input.event.speakerId,
      label    : input.event.speakerLabel,
      at       : input.at
    };
    maybeNominate(makeCandidate(verdict.kind, {
      speakerId   : input.event.speakerId,
      speakerLabel: input.event.speakerLabel
    }, verdict.query, input.at));
  }

  /** Peace was part of the conversation recently (addressed or spoke) — gates the expectancy helper. */
  function recentlyEngaged (now: number): boolean {
    const lastEngagedAt = Math.max(state.lastAddressed?.at ?? 0, state.lastBotSpokeAt);

    return lastEngagedAt > 0 && now - lastEngagedAt <= cfg.expectancyWindowMs;
  }

  function onSilence (input: Extract<RouterInput, { type: 'silence.span' }>): void {
    const free = !activeDraft && !inFlight && deps.executor.isInVoice();

    // Expectancy helper: someone seems to be waiting for peace (a turn went
    // unanswered and the floor fell quiet). Solicited-ish, so NOT budget-capped
    // like proactive — just cooldown-guarded so it taps, never nags.
    if (free && evaluateWaitingExpectancy(state, input.at, lastExpectancyAt, cfg)) {
      lastExpectancyAt = input.at;
      const addressedBy = state.lastAddressed ? {
        speakerId   : state.lastAddressed.speakerId,
        speakerLabel: state.lastAddressed.label
      } : null;

      maybeNominate(makeCandidate('prompted', addressedBy, '', input.at));

      return;
    }

    // Proactive: volunteer on an idle, low-energy lull (budget-capped).
    const floorOpen = input.ms >= cfg.proactiveMinSilenceMs;
    const cooledDown = input.at - lastProactiveDraftAt >= cfg.proactiveCooldownMs;
    const calm = energyLevel(state.energy, cfg) !== 'high';

    if (floorOpen && cooledDown && calm && budgetAvailable(rollBudgetWindow(state, input.at, cfg), cfg) && free) {
      lastProactiveDraftAt = input.at;
      maybeNominate(makeCandidate('proactive', null, '', input.at));
    }
  }

  function submit (input: RouterInput): void {
    deps.log.debug('router.input', {
      meetingId: deps.meetingId,
      type     : input.type
    });

    state = reduce(state, input);

    // Barge-in is NOT triggered by raw voice activity (a cough, a back-channel
    // "mm-hmm", or the bot's own voice echoing back must never cut it off). It's
    // decided on the human's committed words instead — see onUtterance.
    switch (input.type) {
      case 'utterance.committed':
        onUtterance(input);
        break;

      case 'silence.span':
        onSilence(input);
        break;

      case 'speech.finished':
        registerOrDiscard(input.candidateId, true);
        break;

      case 'speech.aborted':
        registerOrDiscard(input.candidateId, false);
        break;

      default:
        break;
    }
  }

  return {
    submit,

    start: () => {
      clockTimer ??= setInterval(() => {
        const now = clock();

        submit({
          type: 'silence.span',
          ms  : now - Math.max(state.lastHumanSpeechAt, state.lastBotSpokeAt),
          at  : now
        });
      }, CLOCK_INTERVAL_MS);
    },

    stop: () => {
      if (clockTimer) {
        clearInterval(clockTimer);
        clockTimer = null;
      }

      clearFinishTimer();

      if (inFlight) {
        bargeIn('router-stop');
      }
    }
  };
}

function parseSpeakerIdSafe (id: string): string | null {
  try {
    return parseSpeakerId(id).namespace;
  } catch {
    return null;
  }
}
