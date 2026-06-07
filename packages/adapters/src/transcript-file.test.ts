import { describe, expect, it } from 'vitest';
import { parseTranscript } from './transcript-file';

describe('parseTranscript', () => {
  it('parses timestamped and untimestamped lines', () => {
    const events = parseTranscript([
      '# kickoff meeting',
      '[00:05] Alice: We should ship the Discord bot first.',
      'Bob: Agreed, voice channels give us diarization for free.',
      '',
      '[01:02:03] Charlie: Late hour-stamped line.'
    ].join('\n'), 'meeting-1');

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      speakerLabel: 'Alice',
      tStart      : 5000,
      source      : 'transcript-file',
      confidence  : 1
    });

    // Untimestamped line lands after the previous one.
    expect(events[1]!.tStart).toBeGreaterThan(events[0]!.tEnd);
    expect(events[1]!.speakerId).toBe('user:bob');
    expect(events[2]!.tStart).toBe(3723000);
    expect(events.every(event => event.meetingId === 'meeting-1')).toBe(true);
  });

  it('throws on unparseable lines', () => {
    expect(() => parseTranscript('no speaker delimiter here', 'm')).toThrow(/unparseable/u);
  });
});
