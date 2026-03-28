import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getSystemPreference(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme) {
  const isDark = theme === 'system' ? getSystemPreference() : theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system')
      return stored;
  } catch {}
  return 'system';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('theme', t);
    } catch {}
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentIsDark =
      theme === 'dark' || (theme === 'system' && getSystemPreference());
    setTheme(currentIsDark ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const isDark =
    theme === 'dark' || (theme === 'system' && getSystemPreference());

  return { theme, setTheme, toggleTheme, isDark };
}
