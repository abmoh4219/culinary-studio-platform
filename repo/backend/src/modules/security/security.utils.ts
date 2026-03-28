import { createHash } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const sorted: Record<string, unknown> = {};

    for (const [key, nested] of entries) {
      sorted[key] = sortObject(nested);
    }

    return sorted;
  }

  return value;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

export function bodyHash(body: unknown): string {
  return sha256Hex(stableJsonStringify(body ?? {}));
}

function parsePrefixes(): string[] {
  const raw = process.env.SECURITY_ACTION_PATH_PREFIXES || '/bookings,/billing,/invoices,/payments';
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function getRequestPath(request: FastifyRequest): string {
  const url = request.raw.url || '/';
  const queryStart = url.indexOf('?');
  return queryStart >= 0 ? url.slice(0, queryStart) : url;
}

export function isMutationRequest(request: FastifyRequest): boolean {
  return request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE';
}

export function isProtectedBusinessAction(request: FastifyRequest): boolean {
  if (!isMutationRequest(request)) {
    return false;
  }

  const path = getRequestPath(request);
  const prefixes = parsePrefixes();

  return prefixes.some((prefix) => path.startsWith(prefix));
}
