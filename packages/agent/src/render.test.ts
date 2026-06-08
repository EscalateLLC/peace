import { describe, expect, it } from 'vitest';
import type { ConversationEvent } from '@peace/core';
import { renderConversation } from './render';

function event (overrides: Partial<ConversationEvent>): ConversationEvent {
  return {
    id          : crypto.randomUUID(),
    meetingId   : 'm1',
    speakerId   : 'discord:1',
    speakerLabel: 'Alice',
    text        : 'hello',
    tStart      : 0,
    tEnd        : 1000,
    confidence  : 1,
    source      : {
      platform: 'discord',
      medium  : 'voice'
    },
    ...overrides
  };
}

describe('renderConversation', () => {
  it('renders speaker-labeled markdown with mm:ss timestamps, in order', () => {
    const out = renderConversation([
      event({
        speakerLabel: 'Alice',
        text        : 'We should ship Friday.',
        tStart      : 91000
      }),
      event({
        speakerLabel: 'Bob',
        text        : 'I will take the spec.',
        tStart      : 102000
      })
    ]);

    expect(out).toBe('[01:31] **Alice:** We should ship Friday.\n[01:42] **Bob:** I will take the spec.');
  });

  it('labels the bot\'s own turns as "peace (you)"', () => {
    const out = renderConversation([
      event({
        speakerLabel: 'peace',
        text        : 'We went with the timeline view.',
        tStart      : 5000
      })
    ]);

    expect(out).toContain('**peace (you):** We went with the timeline view.');
  });

  it('keeps the most recent lines when over the char budget', () => {
    const many = Array.from({ length: 50 }, (unused, i) => event({
      text  : `line ${i} ${'x'.repeat(40)}`,
      tStart: i * 1000
    }));
    const out = renderConversation(many, { maxChars: 200 });

    expect(out.length).toBeLessThanOrEqual(260);
    expect(out).toContain('line 49');
    expect(out).not.toContain('line 0 ');
  });
});
