'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, STORAGE_KEY, type Theme } from './types';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the active theme, syncs it to `<html data-theme>` + localStorage. Pair
 * with `NO_FLASH_SCRIPT` in `<head>` so the server-rendered theme matches.
 */
export function ThemeProvider ({ children, defaultTheme = DEFAULT_THEME }: { children: ReactNode; defaultTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // Adopt whatever the no-flash script already put on <html> (avoids a mismatch).
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme') as Theme | null;

    if (attr && attr !== theme) {
      setThemeState(attr);
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode / disabled storage — the attribute swap still works for the session
    }
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme
    }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme (): ThemeContextValue {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }

  return ctx;
}
