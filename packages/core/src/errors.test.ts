import { describe, expect, it } from 'vitest';
import { PeaceError, asPeaceError, isPeaceError, meetingNoticeSchema } from './index';

describe('PeaceError', () => {
  it('carries code, userMessage, retryable and cause', () => {
    const cause = new Error('402 Payment Required');
    const error = new PeaceError('tts.auth', {
      message    : 'elevenlabs tts 402: payment required',
      userMessage: 'Voice service rejected the request.',
      cause
    });

    expect(error).toBeInstanceOf(Error);
    expect(isPeaceError(error)).toBe(true);
    expect(error.code).toBe('tts.auth');
    expect(error.userMessage).toBe('Voice service rejected the request.');
    expect(error.retryable).toBe(false);
    expect(error.cause).toBe(cause);
  });

  it('defaults retryable to false', () => {
    const error = new PeaceError('tts.unavailable', {
      message    : 'no provider',
      userMessage: 'No voice configured.'
    });

    expect(error.retryable).toBe(false);
  });
});

describe('asPeaceError', () => {
  it('passes a PeaceError through unchanged', () => {
    const original = new PeaceError('tts.transient', {
      message    : 'boom',
      userMessage: 'Try again.',
      retryable  : true
    });

    expect(asPeaceError(original)).toBe(original);
  });

  it('wraps a raw Error as code "unknown" without leaking the message to users', () => {
    const wrapped = asPeaceError(new Error('internal stack detail'));

    expect(wrapped.code).toBe('unknown');
    expect(wrapped.message).toBe('internal stack detail');
    expect(wrapped.userMessage).toBe('Something went wrong.');
  });

  it('wraps a non-Error throw', () => {
    const wrapped = asPeaceError('plain string failure');

    expect(wrapped.code).toBe('unknown');
    expect(wrapped.message).toBe('plain string failure');
  });
});

describe('meetingNoticeSchema', () => {
  it('round-trips a valid notice', () => {
    const notice = {
      meetingId: 'm-1',
      severity : 'error' as const,
      code     : 'tts.auth',
      message  : 'Voice service failed — replying in text.',
      at       : 1717_000_000_000
    };

    expect(meetingNoticeSchema.parse(notice)).toEqual(notice);
  });

  it('rejects an unknown severity', () => {
    expect(() => meetingNoticeSchema.parse({
      meetingId: 'm-1',
      severity : 'fatal',
      code     : 'tts.auth',
      message  : 'x',
      at       : 0
    })).toThrow();
  });
});
