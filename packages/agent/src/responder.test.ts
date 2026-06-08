import { describe, expect, it } from 'vitest';
import { pickDecision } from './responder';

describe('pickDecision', () => {
  it('takes a respond tool call as a spoken reply', () => {
    expect(pickDecision([{
      toolName: 'respond',
      input   : { text: 'We went with the timeline view.' }
    }], '')).toEqual({
      kind      : 'speak',
      text      : 'We went with the timeline view.',
      postToChat: false
    });
  });

  it('honors postToChatToo', () => {
    const decision = pickDecision([{
      toolName: 'respond',
      input   : {
        text         : 'Here are the action items…',
        postToChatToo: true
      }
    }], '');

    expect(decision).toMatchObject({
      kind      : 'speak',
      postToChat: true
    });
  });

  it('takes stay_silent with its reason', () => {
    expect(pickDecision([{
      toolName: 'stay_silent',
      input   : { reason: 'only mentioned in passing' }
    }], '')).toEqual({
      kind  : 'silent',
      reason: 'only mentioned in passing'
    });
  });

  it('prefers respond when both somehow appear', () => {
    const decision = pickDecision([
      {
        toolName: 'stay_silent',
        input   : { reason: 'x' }
      },
      {
        toolName: 'respond',
        input   : { text: 'actually, here…' }
      }
    ], '');

    expect(decision.kind).toBe('speak');
  });

  it('takes leave_call as a leave decision with its goodbye', () => {
    expect(pickDecision([{
      toolName: 'leave_call',
      input   : { goodbye: 'Okay, heading out — bye!' }
    }], '')).toEqual({
      kind   : 'leave',
      goodbye: 'Okay, heading out — bye!'
    });
  });

  it('leave wins over respond/stay_silent', () => {
    const decision = pickDecision([
      {
        toolName: 'respond',
        input   : { text: 'one more thing…' }
      },
      {
        toolName: 'leave_call',
        input   : {}
      }
    ], '');

    expect(decision).toEqual({
      kind   : 'leave',
      goodbye: ''
    });
  });

  it('falls back to plain text when no terminal tool was called', () => {
    expect(pickDecision([{
      toolName: 'get_decisions',
      input   : {}
    }], '  Sure, that works.  ')).toEqual({
      kind      : 'speak',
      text      : 'Sure, that works.',
      postToChat: false
    });
  });

  it('defaults to silence when there is neither a terminal tool nor text', () => {
    expect(pickDecision([], '')).toEqual({
      kind  : 'silent',
      reason: 'no terminal decision'
    });
  });
});
