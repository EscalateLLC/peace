import { createDb, type PeaceDb } from '@peace/db';

let instance: PeaceDb | null = null;

/**
 * One writable connection per server process. Web only writes on user
 * actions (regenerate, diagram edits) — the bot owns the hot path; WAL +
 * busy_timeout serialize the two writers.
 */
export function getDb (): PeaceDb {
  instance ??= createDb();

  return instance;
}
