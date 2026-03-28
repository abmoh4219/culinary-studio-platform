import { describe, expect, it } from 'vitest';

import { buildLoggerOptions } from '../../backend/src/lib/logger';

describe('logger configuration', () => {
  it('redacts sensitive header and credential fields', () => {
    const options = buildLoggerOptions();

    expect(options.redact.paths).toContain('req.headers.authorization');
    expect(options.redact.paths).toContain('req.headers.cookie');
    expect(options.redact.paths).toContain('body.password');
  });

  it('request serializer does not expose sensitive headers', () => {
    const options = buildLoggerOptions();
    const serialized = options.serializers.req({
      method: 'POST',
      url: '/api/v1/auth/login',
      id: 'req-1',
      headers: {
        authorization: 'Bearer abc',
        cookie: 'access_token=secret',
        'set-cookie': 'x=y',
        'content-type': 'application/json'
      }
    });

    expect((serialized.headers as any).authorization).toBe('[REDACTED]');
    expect((serialized.headers as any).cookie).toBe('[REDACTED]');
    expect((serialized.headers as any)['set-cookie']).toBe('[REDACTED]');
  });
});
