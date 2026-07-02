import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemePreference } from './themeContext';

const storageKey = 'backend-test-runner:theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => readSystemTheme());
  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference: (nextPreference: ThemePreference) => {
        localStorage.setItem(storageKey, nextPreference);
        setPreferenceState(nextPreference);
      },
      cyclePreference: () => {
        const nextPreference = preference === 'system' ? 'dark' : preference === 'dark' ? 'light' : 'system';
        localStorage.setItem(storageKey, nextPreference);
        setPreferenceState(nextPreference);
      },
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(storageKey);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function readSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
