import type { FastifyPluginAsync } from 'fastify';

import { AUTH_COOKIE_NAME, getAuthCookieOptions } from './auth.constants';
import { requireAuth, requireRoles } from './auth.middleware';
import { AuthError, loginUser, registerUser } from './auth.service';

type RegisterBody = {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  consentGranted: boolean;
};

type LoginBody = {
  username: string;
  password: string;
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: RegisterBody }>('/register', async (request, reply) => {
    try {
      const user = await registerUser(request.body);
      const token = await reply.jwtSign(
        {
          sub: user.id,
          username: user.username,
          roles: user.roles
        },
        {
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
        }
      );

      reply.setCookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      return reply.code(201).send({ user });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }

      request.log.error(error);
      return reply.code(500).send({ message: 'Internal server error' });
    }
  });

  app.post<{ Body: LoginBody }>('/login', async (request, reply) => {
    try {
      const user = await loginUser(request.body);
      const token = await reply.jwtSign(
        {
          sub: user.id,
          username: user.username,
          roles: user.roles
        },
        {
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
        }
      );

      reply.setCookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      return reply.send({ user });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }

      request.log.error(error);
      return reply.code(500).send({ message: 'Internal server error' });
    }
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, {
      path: '/'
    });

    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const claim = request.user;
    return reply.send({ user: claim });
  });

  app.get(
    '/admin/health',
    {
      preHandler: requireRoles(['ADMIN'])
    },
    async (_request, reply) => {
      return reply.send({ status: 'ok' });
    }
  );
};
