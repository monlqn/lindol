import { useEffect, useState } from 'react';

const KEY = 'lindol:theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';
}

// Applies the theme to <html data-theme> and persists the user's choice.
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}
