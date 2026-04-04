import type { RequestEvent } from '@sveltejs/kit';
import { createHash, createHmac, randomUUID } from 'node:crypto';

import { getFrontendConfig } from './config';

type ApiEvent = Pick<RequestEvent, 'fetch' | 'request'>;

const PROTECTED_PREFIX_FALLBACK = '/bookings,/billing,/invoices,/payments';

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function apiBaseUrl(): string {
  const config = getFrontendConfig();
  return config.apiInternalBaseUrl || config.publicApiBaseUrl;
}

export async function fetchApiJson<T>(event: ApiEvent, path: string): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';

  const response = await event.fetch(`${apiBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      cookie
    }
  });

  if (!response.ok) {
    const body = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(`${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export async function postApiJson<T>(event: ApiEvent, path: string, body: unknown): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';
  const url = `${apiBaseUrl()}${path}`;
  const headers = mutationHeaders(event, 'POST', url, body);

  const response = await event.fetch(url, {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || response.statusText || 'Request failed');
  }

  return (await response.json()) as T;
}

export async function putApiJson<T>(event: ApiEvent, path: string, body: unknown): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';
  const url = `${apiBaseUrl()}${path}`;
  const headers = mutationHeaders(event, 'PUT', url, body);

  const response = await event.fetch(url, {
    method: 'PUT',
    headers: {
      cookie,
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || response.statusText || 'Request failed');
  }

  return (await response.json()) as T;
}

export function createUpcomingWindow(hoursFromNow: number, durationMinutes: number): {
  startAt: string;
  endAt: string;
} {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString()
  };
}

function normalizePath(rawPath: string): string {
  const withoutQuery = rawPath.split('?')[0] || '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;
}

function parseProtectedPrefixes(): string[] {
  const raw = getFrontendConfig().securityActionPathPrefixes || PROTECTED_PREFIX_FALLBACK;
  return raw
    .split(',')
    .map((segment) => normalizePath(segment.trim()))
    .filter((segment) => segment.length > 0);
}

function stripVersionPrefix(pathname: string): string {
  const normalized = normalizePath(pathname);
  const match = normalized.match(/^\/api\/v\d+(\/.*|$)/);
  if (!match) {
    return normalized;
  }

  return normalizePath(match[1] || '/');
}

function isProtectedMutation(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  const candidates = Array.from(new Set([normalized, stripVersionPrefix(normalized)]));
  const prefixes = parseProtectedPrefixes();

  return candidates.some((candidate) =>
    prefixes.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`))
  );
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
      sorted[key] = sortObject(nested);
    }
    return sorted;
  }

  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function bodyHash(body: unknown): string {
  return createHash('sha256').update(stableJson(body ?? {})).digest('hex');
}

function decodeJwtSubFromCookie(cookieHeader: string): string {
  const tokenCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='));

  if (!tokenCookie) {
    return '';
  }

  const token = tokenCookie.slice('access_token='.length);
  const segments = token.split('.');
  if (segments.length < 2) {
    return '';
  }

  try {
    const payloadBase64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadBase64.length % 4 === 0 ? '' : '='.repeat(4 - (payloadBase64.length % 4));
    const decoded = JSON.parse(Buffer.from(`${payloadBase64}${pad}`, 'base64').toString('utf8')) as { sub?: string };
    return decoded.sub || '';
  } catch {
    return '';
  }
}

function mutationHeaders(
  event: ApiEvent,
  method: MutationMethod,
  fullUrl: string,
  body: unknown
): Record<string, string> {
  const parsed = new URL(fullUrl);
  const path = normalizePath(parsed.pathname);

  if (!isProtectedMutation(path)) {
    return {};
  }

  const config = getFrontendConfig();
  const secret = config.signedRequestSecret;
  if (!secret) {
    throw new Error('SIGNED_REQUEST_SECRET is required for protected business mutations');
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const userId = decodeJwtSubFromCookie(event.request.headers.get('cookie') ?? '');
  const canonical = [method, path, timestamp, nonce, userId, bodyHash(body)].join('\n');
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');

  return {
    'x-key-id': config.signedRequestKeyId,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': signature,
    'idempotency-key': randomUUID()
  };
}
