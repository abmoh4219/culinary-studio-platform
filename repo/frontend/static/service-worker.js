/// <reference lib="webworker" />

const CACHE_NAME = 'culinary-studio-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json'
];

const OFFLINE_QUEUE_STORE = 'offline-request-queue';

// Install: precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network-first, queue mutations if offline
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request.clone()).catch(() => {
          // Queue the failed mutation for replay
          return enqueueOfflineRequest(event.request.clone()).then(
            () =>
              new Response(
                JSON.stringify({ queued: true, message: 'Request queued for offline replay' }),
                { status: 202, headers: { 'Content-Type': 'application/json' } }
              )
          );
        })
      );
      return;
    }

    // GET API requests: network-first with cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation/page requests: network-first, fallback to cache then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Listen for online event to replay queued requests
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REPLAY_OFFLINE_QUEUE') {
    replayOfflineQueue();
  }
});

// IndexedDB helpers for offline queue
function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('culinary-offline', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueOfflineRequest(request) {
  try {
    const body = await request.text();
    const db = await openOfflineDb();
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE).add({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now()
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently fail - don't block the response
  }
}

async function replayOfflineQueue() {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);

    const items = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.method !== 'GET' ? item.body : undefined,
          credentials: 'include'
        });
        store.delete(item.id);
      } catch {
        // Leave in queue for next retry
        break;
      }
    }
  } catch {
    // Queue replay failed, will retry next time
  }
}
