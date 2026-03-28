import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ message: 'Unauthorized' });
    return;
  }
}

export function requireRoles(allowedRoles: string[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: 'Unauthorized' });
      return;
    }

    const roles = request.user.roles ?? [];
    const hasRequiredRole = allowedRoles.some((role) => roles.includes(role));

    if (!hasRequiredRole) {
      reply.code(403).send({ message: 'Forbidden' });
      return;
    }
  };
}
