import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/**
 * Walk up from `start` to find the repo root (marked by pnpm-workspace.yaml),
 * so a relative PEACE_DB_PATH means the same file no matter which app
 * (bot, web, cli — each with a different cwd) opens it.
 */
export function findRepoRoot (start: string = process.cwd()): string {
  let current = resolve(start);

  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      // Outside the repo (e.g. a deployed bundle): fall back to cwd.
      return resolve(start);
    }

    current = parent;
  }
}

export function resolveDbPath (path?: string): string {
  const raw = path ?? process.env.PEACE_DB_PATH ?? './peace.db';

  return isAbsolute(raw) ? raw : join(findRepoRoot(), raw);
}

export interface CreateDbOptions {

  /** Defaults to PEACE_DB_PATH (resolved against the repo root) or ./peace.db. */
  path?: string;
  readonly?: boolean;
}

export function createDb (options: CreateDbOptions = {}) {
  const sqlite = new Database(resolveDbPath(options.path), { readonly: options.readonly ?? false });

  if (!options.readonly) {
    sqlite.pragma('journal_mode = WAL');
  }

  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

export type PeaceDb = ReturnType<typeof createDb>;
