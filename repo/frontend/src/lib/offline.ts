const SW_PATH = '/service-worker.js';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });

    window.addEventListener('online', () => {
      registration.active?.postMessage({ type: 'REPLAY_OFFLINE_QUEUE' });
    });

    return registration;
  } catch {
    return null;
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
