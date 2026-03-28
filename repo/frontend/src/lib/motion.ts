import { writable } from 'svelte/store';

export const prefersReducedMotion = writable(false);

export function initializeMotionPreferences(): void {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');

  const apply = () => {
    prefersReducedMotion.set(media.matches);
  };

  apply();
  media.addEventListener('change', apply);
}
