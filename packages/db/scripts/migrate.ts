import { createDb, migrate, resolveDbPath } from '../src/index';

const db = createDb();

migrate(db);
console.log(`migrated ${resolveDbPath()}`);
