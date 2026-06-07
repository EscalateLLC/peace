import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * @peace/logger — the agent-first observability harness.
 *
 * Every long-running process writes structured JSONL to its own ring-buffered
 * file under <repo>/.logs/ so that an AI agent (or a human) can reconstruct
 * exactly what happened after each refinement cycle:
 *
 *   .logs/bot-discord.jsonl     ← current file (newest lines at the end)
 *   .logs/bot-discord.1.jsonl   ← previous generation
 *   .logs/bot-discord.2.jsonl   ← oldest kept generation
 *
 * Design constraints (deliberate):
 * - One writer per file (process-scoped), append-only `appendFileSync` — no
 *   held file handles, so readers/tailers never contend and rotation works
 *   on Windows.
 * - Size-based auto-rotation built in (no external scripts/cron needed):
 *   when the current file passes maxBytes it is renamed to .1 and a fresh
 *   file starts; generations shift up and the oldest is deleted.
 * - One event per line: {"ts","level","app","event",...fields}. `event` is a
 *   stable dotted name per workflow step (e.g. "voice.utterance_transcribed")
 *   — grep for the step, parse the line, done.
 * - Field values are truncated so a single noisy payload can never flood the
 *   ring buffer.
 *
 * NEVER log secrets — log presence booleans (e.g. hasApiKey: true) instead.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info : 20,
  warn : 30,
  error: 40
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug: (event: string, fields?: LogFields) => void;
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;

  /** A logger that stamps `fields` onto every line (e.g. meetingId). */
  child: (fields: LogFields) => Logger;

  /** Where the current log file lives (for "read the logs at …" hints). */
  readonly file: string;
}

export interface CreateLoggerOptions {

  /** Defaults to <repo root>/.logs (repo root = nearest pnpm-workspace.yaml). */
  dir?: string;

  /** Rotate when the current file exceeds this. Default 5 MB. */
  maxBytes?: number;

  /** Generations kept after the current file. Default 3. */
  maxFiles?: number;

  /** Minimum level written. Default: PEACE_LOG_LEVEL env or "debug". */
  level?: LogLevel;

  /** Max string length per field value before truncation. Default 2000. */
  maxFieldLength?: number;
}

const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;
const MAX_FILES_DEFAULT = 3;
const MAX_FIELD_LENGTH_DEFAULT = 2000;

export function createLogger (app: string, options: CreateLoggerOptions = {}): Logger {
  const dir = options.dir ?? join(findRepoRoot(), '.logs');
  const file = join(dir, `${app}.jsonl`);
  const maxBytes = options.maxBytes ?? MAX_BYTES_DEFAULT;
  const maxFiles = options.maxFiles ?? MAX_FILES_DEFAULT;
  const maxFieldLength = options.maxFieldLength ?? MAX_FIELD_LENGTH_DEFAULT;
  const minRank = LEVEL_RANK[options.level ?? envLevel()];

  mkdirSync(dir, { recursive: true });

  let bytes = existsSync(file) ? statSync(file).size : 0;

  const write = (level: LogLevel, event: string, fields: LogFields, bound: LogFields): void => {
    if (LEVEL_RANK[level] < minRank) {
      return;
    }

    const line = `${JSON.stringify({
      ts: new Date().toISOString(),
      level,
      app,
      event,
      ...sanitize(bound, maxFieldLength),
      ...sanitize(fields, maxFieldLength)
    })}\n`;

    if (bytes + line.length > maxBytes) {
      rotate(file, maxFiles);
      bytes = 0;
    }

    try {
      appendFileSync(file, line, 'utf8');
      bytes += Buffer.byteLength(line);
    } catch {
      // Logging must never take the app down.
    }

    if (LEVEL_RANK[level] >= LEVEL_RANK.warn) {
      console.error(`[${app}] ${level} ${event}`, fields);
    }
  };

  const make = (bound: LogFields): Logger => ({
    debug: (event, fields = {}) => write('debug', event, fields, bound),
    info : (event, fields = {}) => write('info', event, fields, bound),
    warn : (event, fields = {}) => write('warn', event, fields, bound),
    error: (event, fields = {}) => write('error', event, fields, bound),
    child: fields => make({
      ...bound,
      ...fields
    }),
    file
  });

  return make({});
}

/** Normalize an unknown thrown value into loggable fields. */
export function errorFields (error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName   : error.name,
      stack       : error.stack
    };
  }

  return { errorMessage: String(error) };
}

function envLevel (): LogLevel {
  const raw = process.env.PEACE_LOG_LEVEL;

  return raw && raw in LEVEL_RANK ? raw as LogLevel : 'debug';
}

function sanitize (fields: LogFields, maxFieldLength: number): LogFields {
  const out: LogFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value.length > maxFieldLength) {
      out[key] = `${value.slice(0, maxFieldLength)}…[+${value.length - maxFieldLength} chars]`;
    } else if (value instanceof Error) {
      out[key] = `${value.name}: ${value.message}`;
    } else {
      out[key] = value;
    }
  }

  return out;
}

/** app.jsonl → app.1.jsonl → app.2.jsonl …; the oldest generation is dropped. */
function rotate (file: string, maxFiles: number): void {
  try {
    const base = file.replace(/\.jsonl$/u, '');
    const oldest = `${base}.${maxFiles}.jsonl`;

    if (existsSync(oldest)) {
      rmSync(oldest, { force: true });
    }

    for (let generation = maxFiles - 1; generation >= 1; generation--) {
      const from = `${base}.${generation}.jsonl`;

      if (existsSync(from)) {
        renameSync(from, `${base}.${generation + 1}.jsonl`);
      }
    }

    if (existsSync(file)) {
      renameSync(file, `${base}.1.jsonl`);
    }
  } catch {
    // If rotation fails (e.g. a reader holds the file on Windows), keep
    // appending to the current file rather than losing lines.
  }
}

/**
 * Walk up to the repo root (marked by pnpm-workspace.yaml) so every process
 * logs to the same .logs/ directory regardless of its cwd. Falls back to cwd
 * outside the repo. (Deliberately duplicated from @peace/db — the logger must
 * stay dependency-free and @peace/core must stay browser-safe.)
 */
export function findRepoRoot (start: string = process.cwd()): string {
  let current = resolve(start);

  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return resolve(start);
    }

    current = parent;
  }
}
