import { defineConfig } from 'vitest/config';
import { preset } from '@peace/config-presets/vitest.preset.mjs';

// Extend the shared preset's test globs to also pick up co-located tests under
// app/ (e.g. the interaction-engine modules in app/_kit/interaction/).
export default defineConfig({
  ...preset,
  test: {
    ...preset.test,
    include: [...preset.test.include, 'app/**/*.test.ts', 'app/**/*.test.tsx']
  }
});
