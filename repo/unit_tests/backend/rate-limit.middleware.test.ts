import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUserRateLimitMiddleware } from '../../backend/src/modules/security/rate-limit.middleware';

type FakeReply = {
  statusCode?: number;
  payload?: unknown;
  headers: Record<string, string>;
  header: (key: string, value: string) => void;
  code: (status: number) => FakeReply;
  send: (payload: unknown) => void;
};

function createReply(): FakeReply {
  const reply: FakeReply = {
    headers: {},
    header(key, value) {
      this.headers[key] = value;
    },
    code(status) {
      this.statusCode = status;
      return this;
    },
    send(payload) {
      this.payload = payload;
    }
  };

  return reply;
}

describe('user rate limit middleware', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_MAX_REQUESTS_PER_MINUTE = '60';
    process.env.NODE_ENV = 'test';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 429 after exceeding local fallback limit and resets after window', async () => {
    // Without Redis, local fallback applies 50% penalty: effective limit = 30
    const appRef = {
      jwt: {
        verify: vi.fn()
      }
    } as any;

    const middleware = createUserRateLimitMiddleware(appRef);

    for (let i = 0; i < 30; i += 1) {
      const reply = createReply();
      await middleware.call(
        appRef,
        {
          ip: '127.0.0.1',
          cookies: {},
          log: { warn: vi.fn() }
        } as any,
        reply as any,
        () => {}
      );
      expect(reply.statusCode, `Request ${i + 1} should not be rate limited`).toBeUndefined();
    }

    const limitedReply = createReply();
    await middleware.call(
      appRef,
      {
        ip: '127.0.0.1',
        cookies: {},
        log: { warn: vi.fn() }
      } as any,
      limitedReply as any,
      () => {}
    );

    expect(limitedReply.statusCode).toBe(429);
    expect(limitedReply.payload).toEqual({ message: 'Too many requests' });

    vi.advanceTimersByTime(60_001);

    const postResetReply = createReply();
    await middleware.call(
      appRef,
      {
        ip: '127.0.0.1',
        cookies: {},
        log: { warn: vi.fn() }
      } as any,
      postResetReply as any,
      () => {}
    );

    expect(postResetReply.statusCode).toBeUndefined();
  });

  it('fails fast in production when REDIS_URL is not configured', async () => {
    vi.useRealTimers();
    const savedNodeEnv = process.env.NODE_ENV;
    const savedRedisUrl = process.env.REDIS_URL;
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;

    const { resetConfigCache } = await import('../../backend/src/lib/config');
    resetConfigCache();

    const appRef = { jwt: { verify: vi.fn() } } as any;

    expect(() => createUserRateLimitMiddleware(appRef)).toThrow(
      'REDIS_URL is required in production'
    );

    process.env.NODE_ENV = savedNodeEnv;
    process.env.REDIS_URL = savedRedisUrl;
    resetConfigCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('applies stricter limits in local fallback mode (50% penalty)', async () => {
    process.env.RATE_LIMIT_MAX_REQUESTS_PER_MINUTE = '100';
    const appRef = { jwt: { verify: vi.fn() } } as any;
    const middleware = createUserRateLimitMiddleware(appRef);

    // Effective limit should be 50 (100 * 0.5)
    for (let i = 0; i < 50; i += 1) {
      const reply = createReply();
      await middleware.call(
        appRef,
        { ip: '10.0.0.1', cookies: {}, log: { warn: vi.fn() } } as any,
        reply as any,
        () => {}
      );
      expect(reply.statusCode).toBeUndefined();
    }

    const limitedReply = createReply();
    await middleware.call(
      appRef,
      { ip: '10.0.0.1', cookies: {}, log: { warn: vi.fn() } } as any,
      limitedReply as any,
      () => {}
    );
    expect(limitedReply.statusCode).toBe(429);
  });
});
