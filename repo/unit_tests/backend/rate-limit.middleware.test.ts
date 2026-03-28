import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('returns 429 after more than 60 requests per minute and resets after window', async () => {
    const appRef = {
      jwt: {
        verify: vi.fn()
      }
    } as any;

    const middleware = createUserRateLimitMiddleware(appRef);

    for (let i = 0; i < 60; i += 1) {
      const reply = createReply();
      await middleware.call(
        appRef,
        {
          ip: '127.0.0.1',
          cookies: {}
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
        cookies: {}
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
        cookies: {}
      } as any,
      postResetReply as any,
      () => {}
    );

    expect(postResetReply.statusCode).toBeUndefined();
  });
});
