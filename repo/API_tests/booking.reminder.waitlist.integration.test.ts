import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getWaitlist, scheduleBookingReminder, createNotification, prismaState } = vi.hoisted(() => ({
  getWaitlist: vi.fn(),
  scheduleBookingReminder: vi.fn(),
  createNotification: vi.fn(),
  prismaState: {
    bookingOwnerUserId: 'owner-1',
    seenReplayKeys: new Set<string>(),
    idempotencyByComposite: new Map<string, any>(),
    idempotencyById: new Map<string, any>(),
    nextId: 1
  }
}));

vi.mock('../backend/src/modules/bookings/booking.service', () => ({
  getBookingAvailability: vi.fn(),
  createBooking: vi.fn(),
  joinWaitlist: vi.fn(),
  getWaitlist,
  scheduleBookingReminder,
  previewCancellation: vi.fn(),
  cancelBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  promoteNextWaitlisted: vi.fn()
}));

vi.mock('../backend/src/modules/notifications/notification.service', () => ({
  createNotification,
  dispatchDueNotifications: vi.fn(),
  getNotificationHistory: vi.fn(),
  getNotificationPreference: vi.fn(),
  updateNotificationPreference: vi.fn()
}));

vi.mock('../backend/src/modules/webhooks/webhook.service', () => ({
  createWebhookConfig: vi.fn(),
  updateWebhookConfig: vi.fn(),
  listWebhookConfigs: vi.fn(),
  publishWebhookEvent: vi.fn(),
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
      booking: {
        findUnique: vi.fn(async () => ({
          id: 'booking-1',
          userId: prismaState.bookingOwnerUserId,
          startAt: new Date('2026-03-01T00:00:00.000Z'),
          endAt: new Date('2026-03-01T01:00:00.000Z'),
          resourceKey: 'session::seat'
        }))
      },
      signedRequestReplay: {
        create: vi.fn(async ({ data }: any) => {
          const replayKey = `${data.scopeKey}::${data.nonce}`;
          if (prismaState.seenReplayKeys.has(replayKey)) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on signed request replay',
              { code: 'P2002', clientVersion: 'test' }
            );
          }

          prismaState.seenReplayKeys.add(replayKey);
          return { id: `replay-${prismaState.seenReplayKeys.size}` };
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

          return prismaState.idempotencyByComposite.get(key) ?? null;
        }),
        create: vi.fn(async ({ data, select }: any) => {
          const key = makeCompositeKey(data.scopeKey, data.idempotencyKey, data.method, data.path);
          if (prismaState.idempotencyByComposite.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on idempotency key',
              { code: 'P2002', clientVersion: 'test' }
            );
          }

          const id = `idem-${prismaState.nextId++}`;
          const record = {
            id,
            ...data,
            responseStatus: null,
            responseBody: null,
            completedAt: null
          };

          prismaState.idempotencyByComposite.set(key, record);
          prismaState.idempotencyById.set(id, record);

          return select ? { id } : record;
        }),
        update: vi.fn(async ({ where, data, select }: any) => {
          const record = prismaState.idempotencyById.get(where.id);
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
import { AuthError } from '../backend/src/modules/auth/auth.service';
import { bodyHash } from '../backend/src/modules/security/security.utils';
import { buildApp } from '../backend/src/app';

describe('booking waitlist privacy and reminder authorization', () => {
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
    prismaState.bookingOwnerUserId = 'owner-1';
    prismaState.seenReplayKeys.clear();
    prismaState.idempotencyByComposite.clear();
    prismaState.idempotencyById.clear();
    prismaState.nextId = 1;

    getWaitlist.mockReset();
    getWaitlist.mockResolvedValue({
      sessionKey: 'group.class.demo',
      startAt: new Date('2026-03-01T00:00:00.000Z'),
      endAt: new Date('2026-03-01T01:00:00.000Z'),
      entries: [
        {
          id: 'entry-1',
          userId: 'owner-1',
          queuePosition: 1,
          status: 'WAITING',
          offeredAt: null,
          convertedAt: null,
          createdAt: new Date('2026-02-28T10:00:00.000Z'),
          bookingId: null
        },
        {
          id: 'entry-2',
          userId: 'member-2',
          queuePosition: 2,
          status: 'WAITING',
          offeredAt: null,
          convertedAt: null,
          createdAt: new Date('2026-02-28T10:02:00.000Z'),
          bookingId: null
        }
      ]
    });

    createNotification.mockReset();
    createNotification.mockResolvedValue({ notification: { id: 'notif-1' } });

    scheduleBookingReminder.mockReset();
    scheduleBookingReminder.mockImplementation(async ({ actorUserId, actorRoles }: any) => {
      const allowed = actorUserId === 'owner-1' || actorRoles.includes('FRONT_DESK') || actorRoles.includes('ADMIN');
      if (!allowed) {
        throw new AuthError('Not allowed to manage this booking', 403);
      }

      return { notification: { id: 'notif-1' } };
    });
  });

  function authCookie(roles: string[], sub: string): string {
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
    const userId = input.userId ?? 'owner-1';
    const canonical = [
      input.method.toUpperCase(),
      input.path,
      timestamp,
      input.nonce,
      userId,
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

  it('redacts other user IDs in waitlist for normal member', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/bookings/waitlist?sessionKey=s&startAt=2026-03-01T00:00:00.000Z&endAt=2026-03-01T01:00:00.000Z',
      headers: {
        cookie: authCookie(['MEMBER'], 'owner-1')
      }
    });

    expect(response.statusCode).toBe(200);
    const entries = response.json().entries;
    expect(entries[0].userId).toBe('owner-1');
    expect(entries[0].bookingId).toBeNull();
    expect(entries[1].userId).toBeNull();
    expect(entries[1].bookingId).toBeNull();
    expect(entries[1].id).toBeNull();
  });

  it('allows full waitlist user IDs for admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/bookings/waitlist?sessionKey=s&startAt=2026-03-01T00:00:00.000Z&endAt=2026-03-01T01:00:00.000Z',
      headers: {
        cookie: authCookie(['ADMIN'], 'admin-1')
      }
    });

    expect(response.statusCode).toBe(200);
    const entries = response.json().entries;
    expect(entries[0].userId).toBe('owner-1');
    expect(entries[1].userId).toBe('member-2');
  });

  it('rejects reminder scheduling by non-owner member', async () => {
    prismaState.bookingOwnerUserId = 'owner-1';
    const path = '/api/v1/bookings/booking-1/reminders';
    const payload = {
      remindAt: '2026-02-28T23:00:00.000Z'
    };

    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['MEMBER'], 'member-2'),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-reminder-a',
          idempotencyKey: 'idem-reminder-a',
          userId: 'member-2'
        })
      },
      payload
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe('Not allowed to manage this booking');
    expect(scheduleBookingReminder).toHaveBeenCalledTimes(1);
  });

  it('allows reminder scheduling by booking owner', async () => {
    prismaState.bookingOwnerUserId = 'owner-1';
    const path = '/api/v1/bookings/booking-1/reminders';
    const payload = {
      remindAt: '2026-02-28T23:00:00.000Z'
    };

    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['MEMBER'], 'owner-1'),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-reminder-owner',
          idempotencyKey: 'idem-reminder-owner',
          userId: 'owner-1'
        })
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    expect(scheduleBookingReminder).toHaveBeenCalledTimes(1);
  });

  it('allows reminder scheduling by front desk staff', async () => {
    prismaState.bookingOwnerUserId = 'owner-1';
    const path = '/api/v1/bookings/booking-1/reminders';
    const payload = {
      remindAt: '2026-02-28T23:00:00.000Z'
    };

    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['FRONT_DESK'], 'desk-1'),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-reminder-staff',
          idempotencyKey: 'idem-reminder-staff',
          userId: 'desk-1'
        })
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    expect(scheduleBookingReminder).toHaveBeenCalledTimes(1);
  });

  it('allows reminder scheduling by admin override role', async () => {
    const path = '/api/v1/bookings/booking-1/reminders';
    const payload = {
      remindAt: '2026-02-28T23:00:00.000Z'
    };

    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: authCookie(['ADMIN'], 'admin-1'),
        ...signedHeaders({
          method: 'POST',
          path,
          payload,
          nonce: 'nonce-reminder-admin',
          idempotencyKey: 'idem-reminder-admin',
          userId: 'admin-1'
        })
      },
      payload
    });

    expect(response.statusCode).toBe(201);
    expect(scheduleBookingReminder).toHaveBeenCalledTimes(1);
  });
});
