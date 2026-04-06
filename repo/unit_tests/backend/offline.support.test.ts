import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(__dirname, '../../frontend');
const hasFrontend = existsSync(frontendRoot);

describe.skipIf(!hasFrontend)('offline-first support artifacts', () => {

  it('service worker exists in static directory', () => {
    const swPath = resolve(frontendRoot, 'static/service-worker.js');
    expect(existsSync(swPath)).toBe(true);

    const content = readFileSync(swPath, 'utf-8');
    expect(content).toContain('CACHE_NAME');
    expect(content).toContain("self.addEventListener('install'");
    expect(content).toContain("self.addEventListener('fetch'");
  });

  it('web app manifest exists', () => {
    const manifestPath = resolve(frontendRoot, 'static/manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('Culinary Studio Platform');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  it('app.html references the manifest', () => {
    const htmlPath = resolve(frontendRoot, 'src/app.html');
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.json');
  });

  it('offline registration module exists', () => {
    const offlinePath = resolve(frontendRoot, 'src/lib/offline.ts');
    expect(existsSync(offlinePath)).toBe(true);

    const content = readFileSync(offlinePath, 'utf-8');
    expect(content).toContain('registerServiceWorker');
    expect(content).toContain('service-worker.js');
  });

  it('root layout registers the service worker', () => {
    const layoutPath = resolve(frontendRoot, 'src/routes/+layout.svelte');
    const content = readFileSync(layoutPath, 'utf-8');
    expect(content).toContain('registerServiceWorker');
    expect(content).toContain("import { registerServiceWorker } from '$lib/offline'");
  });

  it('service worker includes offline request queue logic', () => {
    const swPath = resolve(frontendRoot, 'static/service-worker.js');
    const content = readFileSync(swPath, 'utf-8');

    expect(content).toContain('enqueueOfflineRequest');
    expect(content).toContain('replayOfflineQueue');
    expect(content).toContain('REPLAY_OFFLINE_QUEUE');
    expect(content).toContain('indexedDB');
  });

  it('offline page route exists', () => {
    const offlinePagePath = resolve(frontendRoot, 'src/routes/offline/+page.svelte');
    expect(existsSync(offlinePagePath)).toBe(true);

    const content = readFileSync(offlinePagePath, 'utf-8');
    expect(content).toContain('offline');
  });
});
