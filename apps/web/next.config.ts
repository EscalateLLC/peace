import { join } from 'node:path';
import type { NextConfig } from 'next';

// Env lives at the repo root (shared with bot + cli), not in apps/web.
try {
  process.loadEnvFile(join(import.meta.dirname, '..', '..', '.env'));
} catch {
  // .env is optional
}

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them.
  transpilePackages: ['@peace/ui', '@peace/core', '@peace/db', '@peace/pipeline', '@peace/ai', '@peace/design'],

  // Native module stays external to the server bundle.
  serverExternalPackages: ['better-sqlite3']
};

export default nextConfig;
