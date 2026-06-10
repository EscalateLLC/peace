import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, STORAGE_KEY, THEMES } from './types';
import { FEEL } from './themes';
import { NO_FLASH_SCRIPT } from './no-flash';

describe('themes', () => {
  it('lists the default theme and has no duplicates', () => {
    expect(THEMES).toContain(DEFAULT_THEME);
    expect(new Set(THEMES).size).toBe(THEMES.length);
  });

  it('has a FEEL entry for every theme with positive numeric values', () => {
    for (const theme of THEMES) {
      const feel = FEEL[theme];

      expect(feel, `missing FEEL for ${theme}`).toBeDefined();
      expect(feel.springStiff).toBeGreaterThan(0);
      expect(feel.springDamp).toBeGreaterThan(0);
      expect(feel.motionScale).toBeGreaterThan(0);
    }
  });

  it('does not carry FEEL entries for unknown themes', () => {
    expect(Object.keys(FEEL).sort()).toEqual([...THEMES].sort());
  });
});

describe('NO_FLASH_SCRIPT', () => {
  it('reads the storage key, validates against THEMES, and sets data-theme', () => {
    expect(NO_FLASH_SCRIPT).toContain(JSON.stringify(STORAGE_KEY));
    expect(NO_FLASH_SCRIPT).toContain('data-theme');
    expect(NO_FLASH_SCRIPT).toContain(DEFAULT_THEME);
  });

  it('is a self-contained IIFE guarded by try/catch (never breaks the page)', () => {
    expect(NO_FLASH_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(NO_FLASH_SCRIPT.endsWith('})();')).toBe(true);
    expect(NO_FLASH_SCRIPT).toMatch(/try\{[\s\S]*\}catch/);
  });
});
