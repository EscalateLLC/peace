'use client';

import { THEMES, type Theme } from './types';
import { useTheme } from './theme-provider';

/** Cycles through the available themes. Unstyled by default — pass a className. */
export function ThemeToggle ({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const i = THEMES.indexOf(theme);

    setTheme(THEMES[(i + 1) % THEMES.length] as Theme);
  };

  return (
    <button
      type="button"
      className={className}
      data-part="theme-toggle"
      aria-label={`Theme: ${theme} (click to change)`}
      onClick={next}
    >
      {theme}
    </button>
  );
}
