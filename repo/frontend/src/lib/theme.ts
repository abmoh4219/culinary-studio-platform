import { writable } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'culinary-theme';

export const themePreference = writable<ThemePreference>('system');
export const resolvedTheme = writable<ResolvedTheme>('light');

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(value: ThemePreference): ResolvedTheme {
  return value === 'system' ? getSystemTheme() : value;
}

function applyTheme(value: ThemePreference): void {
  const root = document.documentElement;
  const resolved = resolveTheme(value);

  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = value;

  themePreference.set(value);
  resolvedTheme.set(resolved);
}

export function initializeTheme(): void {
  let next: ThemePreference = 'system';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) {
      next = stored;
    }
  } catch (_error) {
    next = 'system';
  }

  applyTheme(next);
}

export function setTheme(value: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (_error) {
    // no-op
  }

  applyTheme(value);
}

export function syncSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    let value: ThemePreference = 'system';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(stored)) {
        value = stored;
      }
    } catch (_error) {
      value = 'system';
    }

    if (value === 'system') {
      applyTheme('system');
    }
  };

  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
