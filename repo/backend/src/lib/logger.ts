import type { FastifyBaseLogger } from 'fastify';
import { getConfig } from './config';

type LoggerOptions = {
  level: string;
  redact: {
    paths: string[];
    censor: string;
  };
  serializers: {
    req: (request: any) => Record<string, unknown>;
    res: (response: any) => Record<string, unknown>;
  };
};

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.set-cookie',
  'headers.authorization',
  'headers.cookie',
  'headers.set-cookie',
  'body.password',
  'body.token',
  'body.refreshToken'
];

function redactHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!headers) {
    return headers;
  }

  const cloned = { ...headers };
  for (const key of ['authorization', 'cookie', 'set-cookie']) {
    if (key in cloned) {
      cloned[key] = '[REDACTED]';
    }
  }

  return cloned;
}

export function buildLoggerOptions(): LoggerOptions {
  return {
    level: getConfig().LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]'
    },
    serializers: {
      req(request: any) {
        return {
          method: request.method,
          url: request.url,
          id: request.id,
          headers: redactHeaders(request.headers)
        };
      },
      res(response: any) {
        return {
          statusCode: response.statusCode
        };
      }
    }
  };
}

export function childRequestLogger(base: FastifyBaseLogger, input: {
  correlationId: string;
  module: string;
  action: string;
  userId?: string;
}): FastifyBaseLogger {
  return base.child({
    correlationId: input.correlationId,
    module: input.module,
    action: input.action,
    ...(input.userId ? { userId: input.userId } : {})
  });
}
