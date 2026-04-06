import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import Redis from 'ioredis';
import { getConfig } from '../../lib/config';

import { AUTH_COOKIE_NAME } from '../auth/auth.constants';

type Bucket = {
  count: number;
  resetAt: number;
};

const localBuckets = new Map<string, Bucket>();
let redisClient: Redis | null = null;
let redisAvailable = false;

function getRedisClient(): Redis | null {
  const config = getConfig();

  if (!config.REDIS_URL) {
    return null;
  }

  if (redisClient) {
    return redisAvailable ? redisClient : null;
  }

  try {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: false
    });

    if (typeof redisClient.on === 'function') {
      redisClient.on('ready', () => {
        redisAvailable = true;
      });

      redisClient.on('error', () => {
        redisAvailable = false;
      });
    }

    if (typeof redisClient.connect === 'function') {
      redisClient.connect().catch(() => {
        redisAvailable = false;
      });
    }
  } catch {
    redisClient = null;
    redisAvailable = false;
    return null;
  }

  return redisAvailable ? redisClient : null;
}

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

async function checkRedisRateLimit(
  redis: Redis,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const redisKey = `ratelimit:${key}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  const results = await redis.multi()
    .incr(redisKey)
    .pttl(redisKey)
    .exec();

  if (!results) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const count = (results[0]?.[1] as number) ?? 1;
  const ttl = (results[1]?.[1] as number) ?? -1;

  if (ttl < 0) {
    await redis.expire(redisKey, windowSeconds);
  }

  if (count > maxRequests) {
    const remaining = ttl > 0 ? Math.ceil(ttl / 1000) : windowSeconds;
    return { allowed: false, retryAfterSeconds: Math.max(1, remaining) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function checkLocalRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = localBuckets.get(key);

  if (!current || current.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;

  if (localBuckets.size > 5000) {
    for (const [bucketKey, bucket] of localBuckets.entries()) {
      if (bucket.resetAt <= now) {
        localBuckets.delete(bucketKey);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function createUserRateLimitMiddleware(app: FastifyInstance): preHandlerHookHandler {
  const maxRequestsPerMinute = getConfig().RATE_LIMIT_MAX_REQUESTS_PER_MINUTE;
  const windowMs = 60_000;

  return async function userRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = await resolveRateLimitKey(app, request);

    let result: { allowed: boolean; retryAfterSeconds: number };

    const redis = getRedisClient();
    if (redis && redisAvailable) {
      try {
        result = await checkRedisRateLimit(redis, key, maxRequestsPerMinute, windowMs);
      } catch {
        result = checkLocalRateLimit(key, maxRequestsPerMinute, windowMs);
      }
    } else {
      result = checkLocalRateLimit(key, maxRequestsPerMinute, windowMs);
    }

    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfterSeconds));
      reply.code(429).send({ message: 'Too many requests' });
    }
  };
}
