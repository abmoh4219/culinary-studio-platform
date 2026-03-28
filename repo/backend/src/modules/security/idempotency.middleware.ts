import type { FastifyReply, FastifyRequest, onSendHookHandler, preHandlerHookHandler } from 'fastify';
import { IdempotencyStatus, Prisma } from '../../../prisma/generated';
import { prisma } from '../../lib/prisma';

import { bodyHash, getRequestPath, isProtectedBusinessAction, stableJsonStringify } from './security.utils';

const IDEMPOTENCY_HEADER = 'idempotency-key';

type IdempotencyContext = {
  recordId: string;
};

type RequestWithIdempotency = FastifyRequest & {
  idempotencyContext?: IdempotencyContext;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }

  return value ?? null;
}

function keyTtlHours(): number {
  return parsePositiveInt(process.env.IDEMPOTENCY_KEY_TTL_HOURS, 24);
}

function inProgressTimeoutSeconds(): number {
  return parsePositiveInt(process.env.IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS, 30);
}

function requestScope(request: FastifyRequest): { scopeKey: string; userId: string | null } {
  if (request.user?.sub) {
    return {
      scopeKey: `user:${request.user.sub}`,
      userId: request.user.sub
    };
  }

  return {
    scopeKey: `ip:${request.ip}`,
    userId: null
  };
}

function requestFingerprint(request: FastifyRequest): { method: string; path: string; requestHash: string } {
  const method = request.method.toUpperCase();
  const path = getRequestPath(request);
  const hash = bodyHash(request.body);

  return {
    method,
    path,
    requestHash: hash
  };
}

function normalizePayload(payload: unknown): Prisma.JsonValue | null {
  if (payload === undefined || payload === null) {
    return null;
  }

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Prisma.JsonValue;
    } catch {
      return { raw: payload };
    }
  }

  if (Buffer.isBuffer(payload)) {
    return { rawBase64: payload.toString('base64') };
  }

  return payload as Prisma.JsonValue;
}

async function readExistingRecord(request: FastifyRequest, key: string) {
  const { scopeKey } = requestScope(request);
  const { method, path } = requestFingerprint(request);

  return prisma.idempotencyKey.findUnique({
    where: {
      scopeKey_idempotencyKey_method_path: {
        scopeKey,
        idempotencyKey: key,
        method,
        path
      }
    }
  });
}

async function handleReplay(existing: {
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: Prisma.JsonValue | null;
  lockedAt: Date;
}, request: FastifyRequest, reply: FastifyReply, requestHash: string): Promise<boolean> {
  if (existing.requestHash !== requestHash) {
    reply.code(409).send({ message: 'Idempotency key reused with different request payload' });
    return true;
  }

  if (existing.status === IdempotencyStatus.COMPLETED && existing.responseStatus) {
    reply.header('x-idempotent-replay', 'true');
    reply.code(existing.responseStatus).send(existing.responseBody ?? {});
    return true;
  }

  const staleMs = inProgressTimeoutSeconds() * 1000;
  const isStale = Date.now() - existing.lockedAt.getTime() > staleMs;
  if (!isStale) {
    reply.code(409).send({ message: 'Idempotent request is already in progress' });
    return true;
  }

  return false;
}

export function createIdempotencyMiddleware(): {
  preHandler: preHandlerHookHandler;
  onSend: onSendHookHandler;
} {
  const preHandler: preHandlerHookHandler = async (request, reply) => {
    if (!isProtectedBusinessAction(request)) {
      return;
    }

    const keyHeader = headerValue(request.headers[IDEMPOTENCY_HEADER]);
    const idempotencyKey = keyHeader?.trim();

    if (!idempotencyKey) {
      reply.code(400).send({ message: 'Missing Idempotency-Key header' });
      return;
    }

    if (idempotencyKey.length > 120) {
      reply.code(400).send({ message: 'Idempotency-Key is too long' });
      return;
    }

    const { scopeKey, userId } = requestScope(request);
    const { method, path, requestHash } = requestFingerprint(request);

    const existing = await readExistingRecord(request, idempotencyKey);
    if (existing) {
      const handled = await handleReplay(existing, request, reply, requestHash);
      if (handled) {
        return;
      }

      const updated = await prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: {
          status: IdempotencyStatus.IN_PROGRESS,
          lockedAt: new Date(),
          responseStatus: null,
          responseBody: null,
          completedAt: null
        },
        select: { id: true }
      });

      (request as RequestWithIdempotency).idempotencyContext = {
        recordId: updated.id
      };

      return;
    }

    try {
      const created = await prisma.idempotencyKey.create({
        data: {
          userId,
          scopeKey,
          idempotencyKey,
          method,
          path,
          requestHash,
          status: IdempotencyStatus.IN_PROGRESS,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + keyTtlHours() * 60 * 60 * 1000)
        },
        select: { id: true }
      });

      (request as RequestWithIdempotency).idempotencyContext = {
        recordId: created.id
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raceExisting = await readExistingRecord(request, idempotencyKey);

        if (raceExisting) {
          const handled = await handleReplay(raceExisting, request, reply, requestHash);
          if (handled) {
            return;
          }
        }

        reply.code(409).send({ message: 'Idempotent request conflict' });
        return;
      }

      throw error;
    }

    if (Math.random() < 0.02) {
      await prisma.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
    }
  };

  const onSend: onSendHookHandler = async (request, reply, payload) => {
    const context = (request as RequestWithIdempotency).idempotencyContext;
    if (!context) {
      return payload;
    }

    const normalized = normalizePayload(payload);
    const serialized = normalized === null ? null : stableJsonStringify(normalized);
    const responseBody = serialized && serialized.length > 30_000 ? { truncated: true } : normalized;

    await prisma.idempotencyKey.update({
      where: { id: context.recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus: reply.statusCode,
        responseBody,
        completedAt: new Date()
      }
    });

    return payload;
  };

  return {
    preHandler,
    onSend
  };
}
