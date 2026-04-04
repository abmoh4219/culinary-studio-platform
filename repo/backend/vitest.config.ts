import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '/tmp/vite-cache-backend',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    include: ['../unit_tests/backend/**/*.test.ts', '../API_tests/**/*.test.ts']
  }
});
