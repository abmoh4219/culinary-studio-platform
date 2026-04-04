import { createHash } from 'node:crypto';

import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../lib/config';

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
  const raw = getConfig().SECURITY_ACTION_PATH_PREFIXES;
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function normalizePath(path: string): string {
  const queryStart = path.indexOf('?');
  const withoutQuery = queryStart >= 0 ? path.slice(0, queryStart) : path;
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
}

function stripVersionPrefix(path: string): string {
  const normalized = normalizePath(path);
  const match = normalized.match(/^\/api\/v\d+(\/.*|$)/);
  if (!match) {
    return normalized;
  }

  const rest = match[1] || '/';
  return normalizePath(rest);
}

export function getRequestPath(request: FastifyRequest): string {
  const url = request.raw.url || '/';
  return normalizePath(url);
}

export function isMutationRequest(request: FastifyRequest): boolean {
  return request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE';
}

export function isProtectedBusinessAction(request: FastifyRequest): boolean {
  if (!isMutationRequest(request)) {
    return false;
  }

  const requestPath = getRequestPath(request);
  const requestCandidates = Array.from(new Set([requestPath, stripVersionPrefix(requestPath)]));

  const prefixes = parsePrefixes().flatMap((prefix) => {
    const normalized = normalizePath(prefix);
    const stripped = stripVersionPrefix(normalized);
    return normalized === stripped ? [normalized] : [normalized, stripped];
  });

  return requestCandidates.some((candidate) =>
    prefixes.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`))
  );
}
