'use client';

import { THEMES, type Theme, useTheme } from '@peace/design';

/** Product theme switcher — a native select over the design system's themes. */
export function ThemeMenu () {
  const { theme, setTheme } = useTheme();

  return (
    <select
      className="home-theme"
      value={theme}
      aria-label="Theme"
      onChange={e => setTheme(e.target.value as Theme)}
    >
      {THEMES.map(t => <option
        key={t}
        value={t}>{t}</option>)}
    </select>
  );
}
