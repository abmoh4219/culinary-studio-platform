import { createHash, createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({
  getFrontendConfig: () => ({
    apiInternalBaseUrl: 'https://backend:4000/api/v1',
    publicApiBaseUrl: 'https://localhost:4000/api/v1',
    securityActionPathPrefixes: '/bookings,/billing,/invoices,/payments',
    signedRequestSecret: 'frontend_test_signed_secret',
    signedRequestKeyId: 'default'
  })
}));

import { postApiJson, putApiJson } from './api';

function stableJson(value: unknown): string {
  const sortObject = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortObject);
    }

    if (input !== null && typeof input === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
        sorted[key] = sortObject(nested);
      }
      return sorted;
    }

    return input;
  };

  return JSON.stringify(sortObject(value));
}

function bodyHash(payload: unknown): string {
  return createHash('sha256').update(stableJson(payload ?? {})).digest('hex');
}

describe('server api mutation signing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds signed request and idempotency headers for protected booking mutations', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ booking: { id: 'booking-1' } })
    });

    const tokenPayload = Buffer.from(JSON.stringify({ sub: 'member-1' }), 'utf8').toString('base64url');
    const event = {
      fetch,
      request: new Request('http://frontend.local/member', {
        headers: {
          cookie: `access_token=aaa.${tokenPayload}.bbb`
        }
      })
    } as any;

    const body = {
      sessionKey: 'session-1',
      seatKey: 'seat-1',
      startAt: '2026-03-01T10:00:00.000Z',
      endAt: '2026-03-01T11:00:00.000Z',
      capacity: 1
    };

    await postApiJson(event, '/bookings', body);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://backend:4000/api/v1/bookings');
    expect(init.method).toBe('POST');
    expect(init.headers.cookie).toContain('access_token=');
    expect(init.headers['idempotency-key']).toBeTruthy();
    expect(init.headers['x-key-id']).toBe('default');
    expect(init.headers['x-nonce']).toBeTruthy();
    expect(init.headers['x-timestamp']).toMatch(/^\d+$/);

    const canonical = [
      'POST',
      '/api/v1/bookings',
      init.headers['x-timestamp'],
      init.headers['x-nonce'],
      'member-1',
      bodyHash(body)
    ].join('\n');
    const expectedSignature = createHmac('sha256', 'frontend_test_signed_secret').update(canonical).digest('hex');

    expect(init.headers['x-signature']).toBe(expectedSignature);
  });

  it('does not add mutation security headers for unprotected requests', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });

    const event = {
      fetch,
      request: new Request('http://frontend.local/admin', {
        headers: {
          cookie: 'access_token=test-cookie'
        }
      })
    } as any;

    await putApiJson(event, '/notifications/preferences', { emailEnabled: true });

    const [, init] = fetch.mock.calls[0];
    expect(init.headers['x-signature']).toBeUndefined();
    expect(init.headers['idempotency-key']).toBeUndefined();
  });
});
