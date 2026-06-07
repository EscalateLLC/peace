import { createLogger, type Logger } from '@peace/logger';

let instance: Logger | null = null;

/**
 * Server-side only (route handlers / server components) — the logger touches
 * node:fs. Writes to <repo>/.logs/web.jsonl. Polling reads are NOT logged
 * (they fire every 2.5s); mutations and failures are.
 */
export function getLogger (): Logger {
  instance ??= createLogger('web');

  return instance;
}
