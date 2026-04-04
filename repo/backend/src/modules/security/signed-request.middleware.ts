import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { Prisma } from '../../../prisma/generated';
import { getConfig } from '../../lib/config';
import { prisma } from '../../lib/prisma';

import { bodyHash, getRequestPath, isProtectedBusinessAction, sha256Hex } from './security.utils';

const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';
const NONCE_HEADER = 'x-nonce';
const KEY_ID_HEADER = 'x-key-id';

function maxSkewSeconds(): number {
  return getConfig().SIGNED_REQUEST_MAX_SKEW_SECONDS;
}

function nonceTtlSeconds(): number {
  return getConfig().SIGNED_REQUEST_NONCE_TTL_SECONDS;
}

function signingSecret(): string {
  return getConfig().SIGNED_REQUEST_SECRET;
}

function keyId(): string {
  return getConfig().SIGNED_REQUEST_KEY_ID;
}

function parseTimestamp(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.floor(value);
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }

  return value ?? null;
}

function toHexSignature(canonical: string): string {
  return createHmac('sha256', signingSecret()).update(canonical).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');

  if (aBuffer.length === 0 || bBuffer.length === 0 || aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function buildCanonicalString(request: FastifyRequest, timestamp: string, nonce: string): string {
  const method = request.method.toUpperCase();
  const path = getRequestPath(request);
  const hash = bodyHash(request.body);
  const userId = request.user?.sub || '';

  return `${method}\n${path}\n${timestamp}\n${nonce}\n${userId}\n${hash}`;
}

async function persistReplayGuard(request: FastifyRequest, nonce: string, signature: string, canonical: string, timestamp: string): Promise<boolean> {
  const scopeKey = request.user?.sub ? `user:${request.user.sub}` : 'anonymous';
  const requestTimestamp = new Date(Number(timestamp) * 1000);
  const expiresAt = new Date(Date.now() + nonceTtlSeconds() * 1000);

  try {
    await prisma.signedRequestReplay.create({
      data: {
        userId: request.user?.sub ?? null,
        scopeKey,
        nonce,
        requestSignatureHash: sha256Hex(signature),
        canonicalHash: sha256Hex(canonical),
        requestTimestamp,
        expiresAt
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }

    throw error;
  }

  return true;
}

async function verifySignedRequest(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!isProtectedBusinessAction(request)) {
    return true;
  }

  const secret = signingSecret();
  if (!secret) {
    reply.code(500).send({ message: 'Signed request secret is not configured' });
    return false;
  }

  const signature = headerValue(request.headers[SIGNATURE_HEADER]);
  const timestamp = headerValue(request.headers[TIMESTAMP_HEADER]);
  const nonce = headerValue(request.headers[NONCE_HEADER]);
  const requestKeyId = headerValue(request.headers[KEY_ID_HEADER]);

  if (!signature || !timestamp || !nonce || !requestKeyId) {
    reply.code(401).send({ message: 'Missing signed request headers' });
    return false;
  }

  if (requestKeyId !== keyId()) {
    reply.code(401).send({ message: 'Invalid key id' });
    return false;
  }

  const timestampValue = parseTimestamp(timestamp);
  if (timestampValue === null) {
    reply.code(401).send({ message: 'Invalid timestamp header' });
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const skew = Math.abs(nowSeconds - timestampValue);
  if (skew > maxSkewSeconds()) {
    reply.code(401).send({ message: 'Timestamp outside allowed clock skew' });
    return false;
  }

  const canonical = buildCanonicalString(request, String(timestampValue), nonce);
  const expectedSignature = toHexSignature(canonical);
  if (!safeEqualHex(expectedSignature, signature)) {
    reply.code(401).send({ message: 'Invalid request signature' });
    return false;
  }

  const replayAccepted = await persistReplayGuard(request, nonce, signature, canonical, String(timestampValue));
  if (!replayAccepted) {
    reply.code(409).send({ message: 'Replay detected for signed request' });
    return false;
  }

  if (Math.random() < 0.02) {
    await prisma.signedRequestReplay.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }

  return true;
}

export function createSignedRequestMiddleware(): preHandlerHookHandler {
  return async function signedRequestMiddleware(request, reply): Promise<void> {
    const valid = await verifySignedRequest(request, reply);
    if (!valid) {
      return;
    }
  };
}
