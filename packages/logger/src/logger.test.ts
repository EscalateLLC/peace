import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger, errorFields } from './index';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'peace-logger-'));
});

afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force    : true
  });
});

function readLines (file: string): Record<string, unknown>[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

describe('createLogger', () => {
  it('writes parseable JSONL with ts/level/app/event and fields', () => {
    const log = createLogger('test-app', { dir });

    log.info('meeting.started', {
      meetingId: 'm-1',
      platform : 'discord'
    });

    const [line] = readLines(log.file);

    expect(line).toMatchObject({
      level    : 'info',
      app      : 'test-app',
      event    : 'meeting.started',
      meetingId: 'm-1',
      platform : 'discord'
    });
    expect(typeof line!.ts).toBe('string');
    expect(() => new Date(line!.ts as string)).not.toThrow();
  });

  it('filters below the configured level', () => {
    const log = createLogger('test-app', {
      dir,
      level: 'warn'
    });

    log.debug('noise.debug');
    log.info('noise.info');
    log.warn('signal.warn');

    const lines = readLines(log.file);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.event).toBe('signal.warn');
  });

  it('stamps child context onto every line', () => {
    const log = createLogger('test-app', { dir }).child({ meetingId: 'm-42' });

    log.info('segment.inserted', { speaker: 'alice' });

    const [line] = readLines(log.file);

    expect(line).toMatchObject({
      meetingId: 'm-42',
      speaker  : 'alice'
    });
  });

  it('truncates oversized field values', () => {
    const log = createLogger('test-app', {
      dir,
      maxFieldLength: 50
    });

    log.info('big.payload', { blob: 'x'.repeat(500) });

    const [line] = readLines(log.file);

    expect((line!.blob as string).length).toBeLessThan(80);
    expect(line!.blob as string).toContain('[+450 chars]');
  });

  it('rotates generations and never exceeds maxFiles', () => {
    const log = createLogger('test-app', {
      dir,
      maxBytes: 400,
      maxFiles: 2
    });

    for (let index = 0; index < 60; index++) {
      log.info('tick', { index });
    }

    expect(existsSync(join(dir, 'test-app.jsonl'))).toBe(true);
    expect(existsSync(join(dir, 'test-app.1.jsonl'))).toBe(true);
    expect(existsSync(join(dir, 'test-app.3.jsonl'))).toBe(false);

    // Newest line is always in the current file, and every line everywhere parses.
    const current = readLines(log.file);

    expect(current.at(-1)!.index).toBe(59);
  });

  it('errorFields normalizes Error and non-Error throws', () => {
    expect(errorFields(new Error('boom'))).toMatchObject({
      errorMessage: 'boom',
      errorName   : 'Error'
    });
    expect(errorFields('plain failure')).toEqual({ errorMessage: 'plain failure' });
  });
});
