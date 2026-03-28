import type { FastifyError } from 'fastify';

import { AuthError } from '../modules/auth/auth.service';

type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LOCKED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export type ErrorResponseBody = {
  message: string;
  code?: ErrorCode;
  details?: unknown;
};

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: unknown;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationAppError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationAppError';
  }
}

function codeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 400) {
    return 'BAD_REQUEST';
  }

  if (statusCode === 401) {
    return 'UNAUTHORIZED';
  }

  if (statusCode === 403) {
    return 'FORBIDDEN';
  }

  if (statusCode === 404) {
    return 'NOT_FOUND';
  }

  if (statusCode === 409) {
    return 'CONFLICT';
  }

  if (statusCode === 423) {
    return 'LOCKED';
  }

  if (statusCode === 429) {
    return 'RATE_LIMITED';
  }

  return 'INTERNAL_ERROR';
}

export function normalizeError(error: unknown, nodeEnv: string | undefined): {
  statusCode: number;
  body: ErrorResponseBody;
} {
  const isProduction = nodeEnv === 'production';

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        message: error.message,
        code: error.code,
        ...(isProduction ? {} : { details: error.details })
      }
    };
  }

  if (error instanceof AuthError) {
    const code = codeFromStatus(error.statusCode);
    return {
      statusCode: error.statusCode,
      body: {
        message: error.message,
        code
      }
    };
  }

  const fastifyError = error as FastifyError & {
    validation?: unknown;
    statusCode?: number;
  };

  if (fastifyError?.validation) {
    return {
      statusCode: 400,
      body: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        ...(isProduction ? {} : { details: fastifyError.validation })
      }
    };
  }

  const statusCode = typeof fastifyError?.statusCode === 'number' ? fastifyError.statusCode : 500;
  const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isInternal = safeStatus >= 500;

  return {
    statusCode: safeStatus,
    body: {
      message: isInternal && isProduction ? 'Internal server error' : (fastifyError?.message || 'Internal server error'),
      code: codeFromStatus(safeStatus),
      ...(isProduction || !isInternal ? {} : { details: { stack: fastifyError?.stack } })
    }
  };
}

export function normalizeErrorPayload(payload: unknown, statusCode: number): unknown {
  if (statusCode < 400) {
    return payload;
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const data = payload as Record<string, unknown>;
    if (typeof data.message === 'string') {
      return {
        message: data.message,
        ...(typeof data.code === 'string' ? { code: data.code } : { code: codeFromStatus(statusCode) }),
        ...(data.details !== undefined ? { details: data.details } : {})
      } as ErrorResponseBody;
    }
  }

  return payload;
}
