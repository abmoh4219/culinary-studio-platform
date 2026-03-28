import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';

import { AUTH_COOKIE_NAME } from './modules/auth/auth.constants';
import { resolveApiPrefix } from './modules/api/api-versioning';
import { v1Routes } from './modules/api/v1.routes';
import { createIdempotencyMiddleware } from './modules/security/idempotency.middleware';
import { createUserRateLimitMiddleware } from './modules/security/rate-limit.middleware';
import { createSignedRequestMiddleware } from './modules/security/signed-request.middleware';

function resolveCorsOrigin(): true | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === '*') {
    return true;
  }

  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return origins.length > 0 ? origins : true;
}

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: resolveCorsOrigin(),
    credentials: true
  });

  app.register(swagger, {
    stripBasePath: false,
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Culinary Studio API',
        description: 'Versioned backend APIs for operations, billing, workflows, notifications, and analytics.',
        version: '1.0.0'
      },
      servers: [{ url: '/' }],
      tags: [
        { name: 'auth' },
        { name: 'analytics' },
        { name: 'billing' },
        { name: 'bookings' },
        { name: 'notifications' },
        { name: 'webhooks' },
        { name: 'workflows' },
        { name: 'system' }
      ]
    }
  });

  app.register(swaggerUi, {
    routePrefix: '/api/docs'
  });

  app.register(cookie, {
    hook: 'onRequest'
  });

  app.register(jwt, {
    secret: process.env.JWT_ACCESS_SECRET || 'development_access_secret',
    cookie: {
      cookieName: AUTH_COOKIE_NAME,
      signed: false
    }
  });

  app.addHook('preHandler', createUserRateLimitMiddleware(app));
  app.addHook('preHandler', createSignedRequestMiddleware());

  const idempotencyMiddleware = createIdempotencyMiddleware();
  app.addHook('preHandler', idempotencyMiddleware.preHandler);
  app.addHook('onSend', idempotencyMiddleware.onSend);

  app.register(v1Routes, { prefix: resolveApiPrefix('v1') });

  app.get('/health', {
    schema: {
      tags: ['system'],
      summary: 'Service liveness check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }
      }
    }
  }, async () => ({ status: 'ok' }));

  return app;
}
