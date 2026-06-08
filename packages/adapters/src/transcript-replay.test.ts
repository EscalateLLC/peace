import { describe, expect, it } from 'vitest';
import type { ConversationEvent } from '@peace/core';
import type { PlatformHandlers, SpeakerRef } from './platform';
import { createTranscriptReplayAdapter } from './transcript-replay';

function collectingHandlers () {
  const events: ConversationEvent[] = [];
  const speaking: { speaker: SpeakerRef; state: string }[] = [];
  const errors: Error[] = [];
  let closed = false;

  const handlers: PlatformHandlers = {
    onText: event => {
      events.push(event);
    },

    onVoice: () => {
      throw new Error('replay must not emit voice');
    },

    onSpeaking: (speaker, state) => {
      speaking.push({
        speaker,
        state
      });
    },

    onClosed: () => {
      closed = true;
    },

    onError: error => {
      errors.push(error);
    }
  };

  return {
    handlers,
    events,
    speaking,
    errors,
    isClosed: () => closed
  };
}

const transcript = [
  '[00:05] Alice: We should ship the Discord bot first.',
  'Bob: Agreed, voice channels give us diarization for free.'
].join('\n');

describe('createTranscriptReplayAdapter', () => {
  it('drives the platform seam: normalized events, then onClosed', async () => {
    const adapter = createTranscriptReplayAdapter({
      content  : transcript,
      meetingId: 'meeting-1'
    });
    const sink = collectingHandlers();

    expect(adapter.platform).toBe('upload');
    expect(adapter.capabilities.hasTextIngress).toBe(true);
    expect(adapter.capabilities.canSpeak).toBe(false);

    await adapter.connect(sink.handlers);

    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]).toMatchObject({
      meetingId   : 'meeting-1',
      speakerId   : 'user:alice',
      speakerLabel: 'Alice',
      source      : {
        platform: 'upload',
        medium  : 'text'
      }
    });
    expect(sink.isClosed()).toBe(true);
    expect(sink.errors).toEqual([]);
  });

  it('reports parse failures through onError, not by throwing', async () => {
    const adapter = createTranscriptReplayAdapter({
      content  : 'no speaker delimiter here',
      meetingId: 'meeting-1'
    });
    const sink = collectingHandlers();

    await adapter.connect(sink.handlers);

    expect(sink.errors).toHaveLength(1);
    expect(sink.isClosed()).toBe(false);
  });

  it('rejects egress — capabilities say so and the methods enforce it', async () => {
    const adapter = createTranscriptReplayAdapter({
      content  : transcript,
      meetingId: 'meeting-1'
    });

    await expect(adapter.egress.sendText('hi')).rejects.toThrow(/cannot send text/u);
  });
});
