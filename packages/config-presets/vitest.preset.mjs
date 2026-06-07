/**
 * Shared vitest defaults for all @peace packages.
 * Usage in a package's vitest.config.ts:
 *   import { preset } from '@peace/config-presets/vitest.preset.mjs';
 *   export default defineConfig({ ...preset });
 */
export const preset = {
  test: {
    environment    : 'node',
    passWithNoTests: true,
    include        : ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts']
  }
};
