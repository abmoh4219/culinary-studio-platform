import { afterEach, describe, expect, it } from 'vitest';

import { getEnv, resetEnvCache } from '../../backend/src/config/env';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }

  resetEnvCache();
}

describe('env validation', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('allows development defaults for JWT secrets', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const env = getEnv();

    expect(env.JWT_ACCESS_SECRET).toBe('development_access_secret');
    expect(env.JWT_REFRESH_SECRET).toBe('development_refresh_secret');
  });

  it('fails fast in production when JWT secrets are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => getEnv()).toThrow('Invalid runtime environment');
  });
});
