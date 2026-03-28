import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      roles: string[];
    };
    user: {
      sub: string;
      username: string;
      roles: string[];
      iat: number;
      exp: number;
    };
  }
}
