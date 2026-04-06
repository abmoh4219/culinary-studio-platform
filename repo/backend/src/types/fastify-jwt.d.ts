import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      roles: string[];
      tenantId?: string;
    };
    user: {
      sub: string;
      username: string;
      roles: string[];
      tenantId?: string;
      iat: number;
      exp: number;
    };
  }
}
