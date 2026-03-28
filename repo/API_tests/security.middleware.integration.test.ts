import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { joinWaitlist, replayState } = vi.hoisted(() => ({
  joinWaitlist: vi.fn(),
  replayState: {
    seenReplayKeys: new Set<string>(),
    idempotencyByComposite: new Map<string, any>(),
    idempotencyById: new Map<string, any>(),
    nextId: 1
  }
}));

vi.mock('../backend/src/modules/bookings/booking.service', () => ({
  getBookingAvailability: vi.fn(),
  createBooking: vi.fn(),
  joinWaitlist,
  getWaitlist: vi.fn(),
  previewCancellation: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  promoteNextWaitlisted: vi.fn(),
  scheduleBookingReminder: vi.fn()
}));

vi.mock('../backend/src/modules/notifications/notification.service', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
  dispatchDueNotifications: vi.fn(),
  getNotificationHistory: vi.fn(),
  getNotificationPreference: vi.fn(),
  updateNotificationPreference: vi.fn()
}));

vi.mock('../backend/src/modules/webhooks/webhook.service', () => ({
  createWebhookConfig: vi.fn(),
  updateWebhookConfig: vi.fn(),
  listWebhookConfigs: vi.fn(),
  publishWebhookEvent: vi.fn().mockResolvedValue({ queued: 1 }),
  dispatchDueWebhookLogs: vi.fn(),
  queryWebhookLogs: vi.fn(),
  queryWebhookFailureAlerts: vi.fn(),
  acknowledgeWebhookFailureAlert: vi.fn()
}));

vi.mock('../backend/src/lib/prisma', async () => {
  const { Prisma } = await import('../backend/prisma/generated');

  const makeCompositeKey = (scopeKey: string, idempotencyKey: string, method: string, path: string): string =>
    `${scopeKey}::${idempotencyKey}::${method}::${path}`;

  return {
    prisma: {
      signedRequestReplay: {
        create: vi.fn(async ({ data }: any) => {
          const replayKey = `${data.scopeKey}::${data.nonce}`;
          if (replayState.seenReplayKeys.has(replayKey)) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on the fields: (scopeKey, nonce)',
              { code: 'P2002', clientVersion: 'test' }
            );
          }

          replayState.seenReplayKeys.add(replayKey);
          return { id: `replay-${replayState.seenReplayKeys.size}` };
        }),
        deleteMany: vi.fn(async () => ({ count: 0 }))
      },
      idempotencyKey: {
        findUnique: vi.fn(async ({ where }: any) => {
          const key = makeCompositeKey(
            where.scopeKey_idempotencyKey_method_path.scopeKey,
            where.scopeKey_idempotencyKey_method_path.idempotencyKey,
            where.scopeKey_idempotencyKey_method_path.method,
            where.scopeKey_idempotencyKey_method_path.path
          );

          return replayState.idempotencyByComposite.get(key) ?? null;
        }),
        create: vi.fn(async ({ data, select }: any) => {
          const key = makeCompositeKey(data.scopeKey, data.idempotencyKey, data.method, data.path);
          if (replayState.idempotencyByComposite.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on composite idempotency key',
              { code: 'P2002', clientVersion: 'test' }
            );
          }

          const id = `idem-${replayState.nextId++}`;
          const record = {
            id,
            ...data,
            responseStatus: null,
            responseBody: null,
            completedAt: null
          };

          replayState.idempotencyByComposite.set(key, record);
          replayState.idempotencyById.set(id, record);

          return select ? { id } : record;
        }),
        update: vi.fn(async ({ where, data, select }: any) => {
          const record = replayState.idempotencyById.get(where.id);
          if (!record) {
            throw new Error('Idempotency record not found');
          }

          Object.assign(record, data);

          return select ? { id: record.id } : record;
        }),
        deleteMany: vi.fn(async () => ({ count: 0 }))
      }
    }
  };
});

import { AUTH_COOKIE_NAME } from '../backend/src/modules/auth/auth.constants';
import { bodyHash } from '../backend/src/modules/security/security.utils';
import { buildApp } from '../backend/src/app';

describe('security middleware on versioned API paths', () => {
  process.env.SECURITY_ACTION_PATH_PREFIXES = '/bookings,/billing,/invoices,/payments';
  process.env.SIGNED_REQUEST_SECRET = 'qa_signed_request_secret_for_tests';
  process.env.SIGNED_REQUEST_KEY_ID = 'default';

  const app = buildApp();

  beforeAll(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    await app.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  beforeEach(() => {
    replayState.seenReplayKeys.clear();
    replayState.idempotencyByComposite.clear();
    replayState.idempotencyById.clear();
    replayState.nextId = 1;

    joinWaitlist.mockReset();
    joinWaitlist.mockResolvedValue({
      alreadyQueued: false,
      waitlistEntry: {
        id: 'waitlist-1',
        userId: 'member-1',
        queuePosition: 1,
        status: 'WAITING',
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      }
    });
  });

  function authCookie(roles: string[], sub = 'member-1'): string {
    const token = app.jwt.sign({ sub, username: sub, roles });
    return `${AUTH_COOKIE_NAME}=${token}`;
  }

  function signedHeaders(input: {
    method: string;
    path: string;
    payload: unknown;
    nonce: string;
    idempotencyKey: string;
    userId?: string;
    timestamp?: string;
  }): Record<string, string> {
    const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
    const canonical = [
      input.method.toUpperCase(),
      input.path,
      timestamp,
      input.nonce,
      input.userId ?? '',
      bodyHash(input.payload)
    ].join('\n');

    const signature = createHmac('sha256', process.env.SIGNED_REQUEST_SECRET || '')
      .update(canonical)
      .digest('hex');

    return {
      'content-type': 'application/json',
      'x-signature': signature,
      'x-timestamp': timestamp,
      'x-nonce': input.nonce,
      'x-key-id': process.env.SIGNED_REQUEST_KEY_ID || 'default',
      'idempotency-key': input.idempotencyKey
    };
  }

  it('rejects /api/v1 protected mutation without signature/idempotency headers', async () => {
    const payload = {
      sessionKey: 'group.class.demo',
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-01T01:00:00.000Z',
      capacity: 10,
      contact: 'member-1@example.com'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings/waitlist',
      headers: {
        cookie: authCookie(['MEMBER'])
      },
      payload
    });

    expect(response.statusCode).toBe(401);
    expect(joinWaitlist).not.toHaveBeenCalled();
  });

  it('allows /api/v1 protected mutation with valid signed request and idempotency headers', async () => {
    const path = '/api/v1/bookings/waitlist';
    const payload = {
      sessionKey: 'group.class.demo',
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-01T01:00:00.000Z',
      capacity: 10,
      contact: 'member-1@example.com'
    };

    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['MEMBER']),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-a',
          idempotencyKey: 'idem-a'
        })
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().waitlistEntry.id).toBe('waitlist-1');
    expect(joinWaitlist).toHaveBeenCalledTimes(1);
  });

  it('rejects replay nonce on /api/v1 protected mutation', async () => {
    const path = '/api/v1/bookings/waitlist';
    const payload = {
      sessionKey: 'group.class.demo',
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-01T01:00:00.000Z',
      capacity: 10,
      contact: 'member-1@example.com'
    };

    const first = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['MEMBER']),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-replay',
          idempotencyKey: 'idem-1'
        })
      },
      payload
    });

    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['MEMBER']),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-replay',
          idempotencyKey: 'idem-2'
        })
      },
      payload
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().message).toContain('Replay detected');
    expect(joinWaitlist).toHaveBeenCalledTimes(1);
  });

  it('does not double-process duplicate idempotency key on signed mutation', async () => {
    const path = '/api/v1/bookings/waitlist';
    const payload = {
      sessionKey: 'group.class.demo',
      startAt: '2026-03-01T00:00:00.000Z',
      endAt: '2026-03-01T01:00:00.000Z',
      capacity: 10,
      contact: 'member-1@example.com'
    };

    const firstHeaders = {
      cookie: authCookie(['MEMBER']),
      ...signedHeaders({
        method: 'POST',
        path,
        payload,
        nonce: 'nonce-idem-a-1',
        idempotencyKey: 'idem-dedup-1'
      })
    };

    const secondHeaders = {
      cookie: authCookie(['MEMBER']),
      ...signedHeaders({
        method: 'POST',
        path,
        payload,
        nonce: 'nonce-idem-a-2',
        idempotencyKey: 'idem-dedup-1'
      })
    };

    const first = await app.inject({
      method: 'POST',
      url: path,
      headers: firstHeaders,
      payload
    });

    const second = await app.inject({
      method: 'POST',
      url: path,
      headers: secondHeaders,
      payload
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(joinWaitlist).toHaveBeenCalledTimes(1);
  });
});
