import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeTheme, setTheme } from './theme';

describe('theme controls', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
  });

  it('loads dark theme from persisted preference', () => {
    localStorage.setItem('culinary-theme', 'dark');
    initializeTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists selected theme', () => {
    setTheme('light');
    expect(localStorage.getItem('culinary-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
