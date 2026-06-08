import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationEvent } from '@peace/core';
import { createLogger } from '@peace/logger';
import { createParticipationRouter, type ParticipationRouter } from './router';
import type { DraftOutcome, RouterExecutor, SpeakerRef } from './types';

const log = createLogger('router-test', { dir: join(tmpdir(), 'peace-router-test-logs') });

const alice: SpeakerRef = {
  speakerId   : 'discord:1',
  speakerLabel: 'Alice'
};
const bob: SpeakerRef = {
  speakerId   : 'discord:2',
  speakerLabel: 'Bob'
};

function ev (speaker: SpeakerRef, text: string): ConversationEvent {
  return {
    id          : crypto.randomUUID(),
    meetingId   : 'm1',
    speakerId   : speaker.speakerId,
    speakerLabel: speaker.speakerLabel,
    text,
    tStart      : 0,
    tEnd        : 1000,
    confidence  : 1,
    source      : {
      platform: 'discord',
      medium  : 'voice'
    }
  };
}

function fakeExecutor () {
  const calls = {
    speak   : [] as string[],
    abort   : [] as string[],
    register: [] as string[]
  };
  let seq = 0;
  let inVoice = true;
  const executor: RouterExecutor = {
    speak: candidate => {
      calls.speak.push(candidate.id);

      return Promise.resolve({ id: `h-${++seq}` });
    },
    abortSpeech : (unused, reason) => calls.abort.push(reason),
    registerTurn: candidate => calls.register.push(candidate.id),
    isInVoice   : () => inVoice
  };

  return {
    executor,
    calls,
    setInVoice: (value: boolean) => {
      inVoice = value;
    }
  };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 5));

let router: ParticipationRouter | null = null;

afterEach(() => {
  router?.stop();
  router = null;
});

describe('participation router — deliver & register', () => {
  it('addressed → speak → register on finished', async () => {
    const ex = fakeExecutor();
    const draft = vi.fn<() => Promise<DraftOutcome>>().mockResolvedValue({
      kind: 'speak',
      text: 'We shipped the timeline view.'
    });

    let now = 1000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft,
      executor : ex.executor,
      log,
      now      : () => now
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, what did we decide?'),
      at   : now
    });
    await flush();

    expect(draft).toHaveBeenCalledWith(expect.objectContaining({
      mode       : 'addressed',
      addressedBy: 'Alice'
    }));
    expect(ex.calls.speak).toHaveLength(1);

    now = 1500;
    router.submit({
      type       : 'speech.finished',
      candidateId: ex.calls.speak[0] as string,
      at         : now
    });

    expect(ex.calls.register).toEqual(ex.calls.speak);
  });

  it('answers a follow-up question that does NOT repeat the wake word', async () => {
    const ex = fakeExecutor();
    const draft = vi.fn<() => Promise<DraftOutcome>>().mockResolvedValue({
      kind: 'speak',
      text: 'The budget is unchanged.'
    });

    let now = 1000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft,
      executor : ex.executor,
      log,
      now      : () => now
    });

    // Bot spoke recently → a bare question counts as a follow-up.
    router.submit({
      type       : 'speech.finished',
      candidateId: 'seed',
      at         : 1000
    });
    now = 4000;
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'and what about the budget?'),
      at   : now
    });
    await flush();

    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ mode: 'follow-up' }));
    expect(ex.calls.speak).toHaveLength(1);
  });
});

describe('participation router — the register-or-discard invariant', () => {
  it('barge-in (addressed mid-reply) aborts and NEVER registers the turn', async () => {
    const ex = fakeExecutor();

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind: 'speak',
        text: 'Let me explain…'
      }),
      executor: ex.executor,
      log,
      now     : () => 1000
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, explain the plan'),
      at   : 1000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(1);

    // A human addresses the bot again, mid-reply — a real reason to cut in.
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'peace, actually hold that thought'),
      at   : 1100
    });
    await flush();
    expect(ex.calls.abort).toHaveLength(1);

    router.submit({
      type       : 'speech.aborted',
      candidateId: ex.calls.speak[0] as string,
      reason     : 'barge-in',
      at         : 1150
    });

    expect(ex.calls.register).toHaveLength(0); // the keystone: no trace
  });

  it('does NOT interrupt when a human just talks (no address, no cue)', async () => {
    const ex = fakeExecutor();

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind: 'speak',
        text: 'Here is the long answer…'
      }),
      executor: ex.executor,
      log,
      now     : () => 1000
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, explain the plan'),
      at   : 1000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(1);

    // Voice activity + a back-channel remark to ANOTHER human — not a reason.
    router.submit({
      type   : 'speaker.start',
      speaker: bob,
      at     : 1100
    });
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'yeah totally, I agree with that'),
      at   : 1200
    });
    await flush();

    expect(ex.calls.abort).toHaveLength(0); // the bot finishes its turn
  });

  it('interrupts on a bare interrupt cue ("wait…") with no wake word', async () => {
    const ex = fakeExecutor();

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind: 'speak',
        text: 'A long-winded answer…'
      }),
      executor: ex.executor,
      log,
      now     : () => 1000
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, explain the plan'),
      at   : 1000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(1);

    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'wait, that is not what I meant'),
      at   : 1100
    });
    await flush();

    expect(ex.calls.abort).toHaveLength(1);
  });

  it('discards a draft that went stale while the model was thinking', async () => {
    const ex = fakeExecutor();
    let resolveDraft: (outcome: DraftOutcome) => void = () => undefined;
    let now = 1000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => new Promise<DraftOutcome>(resolve => {
        resolveDraft = resolve;
      }),
      executor: ex.executor,
      log,
      now     : () => now
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, summarize'),
      at   : now
    });
    await flush();

    now = 1000 + 9000; // past the candidate TTL (8s)
    resolveDraft({
      kind: 'speak',
      text: 'late answer'
    });
    await flush();

    expect(ex.calls.speak).toHaveLength(0);
    expect(ex.calls.register).toHaveLength(0);
  });

  it('discards when a human grabbed the floor while drafting', async () => {
    const ex = fakeExecutor();
    let resolveDraft: (outcome: DraftOutcome) => void = () => undefined;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => new Promise<DraftOutcome>(resolve => {
        resolveDraft = resolve;
      }),
      executor: ex.executor,
      log,
      now     : () => 1000
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, summarize'),
      at   : 1000
    });
    await flush();

    // Bob takes the floor before the draft returns.
    router.submit({
      type   : 'speaker.start',
      speaker: bob,
      at     : 1100
    });
    resolveDraft({
      kind: 'speak',
      text: 'answer'
    });
    await flush();

    expect(ex.calls.speak).toHaveLength(0);
  });
});

describe('participation router — proactive (budget-gated)', () => {
  it('volunteers on a floor-open lull, then respects the budget cap', async () => {
    const ex = fakeExecutor();
    const draft = vi.fn<() => Promise<DraftOutcome>>().mockResolvedValue({
      kind: 'speak',
      text: 'One thing to consider…'
    });

    router = createParticipationRouter({
      meetingId: 'm1',
      draft,
      executor : ex.executor,
      log,
      config   : {
        budgetCap          : 1,
        proactiveCooldownMs: 0
      },
      now: () => 5000
    });

    router.submit({
      type: 'silence.span',
      ms  : 3000,
      at  : 5000
    });
    await flush();

    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ mode: 'proactive' }));
    expect(ex.calls.speak).toHaveLength(1);

    router.submit({
      type       : 'speech.finished',
      candidateId: ex.calls.speak[0] as string,
      at         : 6000
    });
    expect(ex.calls.register).toHaveLength(1);

    // Budget (cap 1) now exhausted — a second lull does not draft again.
    router.submit({
      type: 'silence.span',
      ms  : 3000,
      at  : 8000
    });
    await flush();
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the agent declines', async () => {
    const ex = fakeExecutor();

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind  : 'silent',
        reason: 'nothing useful to add'
      }),
      executor: ex.executor,
      log,
      config  : { proactiveCooldownMs: 0 },
      now     : () => 5000
    });

    router.submit({
      type: 'silence.span',
      ms  : 3000,
      at  : 5000
    });
    await flush();

    expect(ex.calls.speak).toHaveLength(0);
  });
});

describe('participation router — expectancy (the helper)', () => {
  it('answers a follow-up that lands past the old 12s window (widened to 30s)', async () => {
    const ex = fakeExecutor();
    let now = 1000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind: 'speak',
        text: 'sure'
      }),
      executor: ex.executor,
      log,
      now     : () => now
    });

    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, explain the plan'),
      at   : 1000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(1);

    now = 2000;
    router.submit({
      type       : 'speech.finished',
      candidateId: ex.calls.speak[0] as string,
      at         : 2000
    });

    // 13s after peace finished — past the OLD 12s window, inside the new 30s one.
    now = 15000;
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'what about the timeline?'),
      at   : 15000
    });
    await flush();

    expect(ex.calls.speak).toHaveLength(2);
  });

  it('taps peace when a human turn goes unanswered and the floor falls quiet', async () => {
    const ex = fakeExecutor();
    const draft = vi.fn<() => Promise<DraftOutcome>>().mockResolvedValue({
      kind: 'speak',
      text: 'on it'
    });
    let now = 1000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft,
      executor : ex.executor,
      log,
      now      : () => now
    });

    // Engage: peace is addressed, answers, finishes.
    router.submit({
      type : 'utterance.committed',
      event: ev(alice, 'peace, status?'),
      at   : 1000
    });
    await flush();
    now = 2000;
    router.submit({
      type       : 'speech.finished',
      candidateId: ex.calls.speak[0] as string,
      at         : 2000
    });
    expect(ex.calls.speak).toHaveLength(1);

    // A plain statement (not a question, no wake word) — the reflex ignores it.
    now = 3000;
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'the deploy went fine'),
      at   : 3000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(1);

    // Floor quiet ~3s later → the expectancy monitor taps peace.
    now = 6000;
    router.submit({
      type: 'silence.span',
      ms  : 3000,
      at  : 6000
    });
    await flush();

    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ mode: 'prompted' }));
    expect(ex.calls.speak).toHaveLength(2);
  });

  it('stays out of human-to-human talk (no recent engagement)', async () => {
    const ex = fakeExecutor();
    let now = 3000;

    router = createParticipationRouter({
      meetingId: 'm1',
      draft    : () => Promise.resolve({
        kind: 'speak',
        text: 'hi'
      }),
      executor: ex.executor,
      log,
      now     : () => now
    });

    // A question between two humans — peace has never been engaged.
    router.submit({
      type : 'utterance.committed',
      event: ev(bob, 'alice, did you finish?'),
      at   : 3000
    });
    await flush();
    expect(ex.calls.speak).toHaveLength(0);

    now = 6000;
    router.submit({
      type: 'silence.span',
      ms  : 3000,
      at  : 6000
    });
    await flush();

    expect(ex.calls.speak).toHaveLength(0);
  });
});
