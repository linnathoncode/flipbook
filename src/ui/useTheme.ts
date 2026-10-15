import { useEffect } from 'react';
import { usePreference } from './usePreference';

export type Theme = 'light' | 'dark';

/** Follows the system until the user picks one with the toggle; the pick is remembered. */
export function useTheme(): [Theme, () => void] {
  const [chosen, setChosen] = usePreference<Theme | null>('theme', null);
  const theme = chosen ?? systemTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, () => setChosen(theme === 'dark' ? 'light' : 'dark')];
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
