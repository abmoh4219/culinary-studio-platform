import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { getConfig } from '../../lib/config';

import { AUTH_COOKIE_NAME } from '../auth/auth.constants';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

async function resolveRateLimitKey(app: FastifyInstance, request: FastifyRequest): Promise<string> {
  const token = request.cookies[AUTH_COOKIE_NAME];

  if (token) {
    try {
      const payload = await app.jwt.verify<{ sub?: string }>(token);
      if (payload.sub) {
        return `user:${payload.sub}`;
      }
    } catch {
      // Fall back to IP key.
    }
  }

  return `ip:${request.ip}`;
}

export function createUserRateLimitMiddleware(app: FastifyInstance): preHandlerHookHandler {
  const maxRequestsPerMinute = getConfig().RATE_LIMIT_MAX_REQUESTS_PER_MINUTE;
  const windowMs = 60_000;

  return async function userRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = await resolveRateLimitKey(app, request);
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return;
    }

    if (current.count >= maxRequestsPerMinute) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      reply.header('Retry-After', String(retryAfterSeconds));
      reply.code(429).send({ message: 'Too many requests' });
      return;
    }

    current.count += 1;

    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }
  };
}
