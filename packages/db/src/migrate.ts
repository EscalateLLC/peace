import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { PeaceDb } from './client';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Apply all pending SQL migrations from this package's drizzle/ folder. */
export function migrate (db: PeaceDb): void {
  drizzleMigrate(db, { migrationsFolder: join(packageDir, 'drizzle') });
}
