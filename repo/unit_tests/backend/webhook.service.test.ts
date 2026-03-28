import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  webhookConfigFindMany,
  webhookLogFindMany,
  webhookLogFindUnique,
  webhookLogUpdate,
  webhookLogGroupBy,
  webhookFailureAlertFindFirst,
  webhookFailureAlertCreate,
  webhookFailureAlertFindMany,
  webhookFailureAlertFindUnique,
  webhookFailureAlertUpdate,
  userRoleFindMany,
  txNotificationCreate,
  transaction
} = vi.hoisted(() => ({
  webhookConfigFindMany: vi.fn(),
  webhookLogFindMany: vi.fn(),
  webhookLogFindUnique: vi.fn(),
  webhookLogUpdate: vi.fn(),
  webhookLogGroupBy: vi.fn(),
  webhookFailureAlertFindFirst: vi.fn(),
  webhookFailureAlertCreate: vi.fn(),
  webhookFailureAlertFindMany: vi.fn(),
  webhookFailureAlertFindUnique: vi.fn(),
  webhookFailureAlertUpdate: vi.fn(),
  userRoleFindMany: vi.fn(),
  txNotificationCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../backend/src/lib/crypto', () => ({
  encryptOptionalField: vi.fn((value: string | null | undefined) => ({
    ciphertext: value ?? null,
    iv: value ? 'iv' : null
  })),
  encryptFieldValue: vi.fn((value: string) => ({ ciphertext: value, iv: 'iv' })),
  decryptOptionalField: vi.fn((ciphertext: string | null | undefined) => ciphertext ?? null)
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    webhookConfig: {
      findMany: webhookConfigFindMany
    },
    webhookLog: {
      findMany: webhookLogFindMany,
      findUnique: webhookLogFindUnique,
      update: webhookLogUpdate,
      groupBy: webhookLogGroupBy
    },
    webhookFailureAlert: {
      findFirst: webhookFailureAlertFindFirst,
      create: webhookFailureAlertCreate,
      findMany: webhookFailureAlertFindMany,
      findUnique: webhookFailureAlertFindUnique,
      update: webhookFailureAlertUpdate
    },
    userRole: {
      findMany: userRoleFindMany
    },
    $transaction: transaction
  }
}));

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import {
  acknowledgeWebhookFailureAlert,
  dispatchDueWebhookLogs,
  publishWebhookEvent,
  queryWebhookFailureAlerts,
  queryWebhookLogs
} from '../../backend/src/modules/webhooks/webhook.service';

describe('webhook.service', () => {
  beforeEach(() => {
    process.env.WEBHOOK_FAILURE_ALERT_THRESHOLD_ATTEMPTS = '3';
    webhookConfigFindMany.mockReset();
    webhookLogFindMany.mockReset();
    webhookLogFindUnique.mockReset();
    webhookLogUpdate.mockReset();
    webhookLogGroupBy.mockReset();
    webhookFailureAlertFindFirst.mockReset();
    webhookFailureAlertCreate.mockReset();
    webhookFailureAlertFindMany.mockReset();
    webhookFailureAlertFindUnique.mockReset();
    webhookFailureAlertUpdate.mockReset();
    userRoleFindMany.mockReset();
    txNotificationCreate.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback: any) =>
      callback({
        notification: {
          create: txNotificationCreate
        },
        webhookLog: {
          create: vi.fn()
        }
      })
    );
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queues webhook events for active configs', async () => {
    webhookConfigFindMany.mockResolvedValue([{ id: 'config-1' }, { id: 'config-2' }]);

    const result = await publishWebhookEvent({
      eventKey: 'booking.success',
      payload: { bookingId: 'booking-1' }
    });

    expect(result).toEqual({ eventKey: 'booking.success', queued: 2 });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('marks successful webhook delivery and returns dispatch summary', async () => {
    webhookLogFindMany.mockResolvedValue([{ id: 'log-1' }]);
    webhookLogFindUnique.mockResolvedValue({
      id: 'log-1',
      webhookConfigId: 'config-1',
      eventKey: 'booking.success',
      attemptNumber: 1,
      requestBodyCiphertext: '{"ok":true}',
      requestBodyIv: 'iv',
      requestedAt: new Date('2026-03-01T00:00:00.000Z'),
      webhookConfig: {
        id: 'config-1',
        status: 'ACTIVE',
        endpointCiphertext: 'https://example.test/webhook',
        endpointIv: 'iv',
        signingSecretCiphertext: 'super_secret_value',
        signingSecretIv: 'iv',
        timeoutSeconds: 5,
        maxRetries: 3,
        headersJson: null
      }
    });
    (global.fetch as any).mockResolvedValue(new Response('ok', { status: 200, headers: { 'x-result': 'accepted' } }));
    webhookLogGroupBy.mockResolvedValue([{ deliveryStatus: 'SUCCESS', _count: { _all: 1 } }]);

    const result = await dispatchDueWebhookLogs({ actorRoles: ['ADMIN'], limit: 1 });

    expect(result.attempted).toBe(1);
    expect(webhookLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({
          deliveryStatus: 'SUCCESS',
          responseStatusCode: 200,
          errorMessage: null
        })
      })
    );
  });

  it('requeues retryable failures and creates a failure alert at threshold', async () => {
    webhookLogFindMany.mockResolvedValue([{ id: 'log-2' }]);
    webhookLogFindUnique.mockResolvedValue({
      id: 'log-2',
      webhookConfigId: 'config-1',
      eventKey: 'booking.success',
      attemptNumber: 2,
      requestBodyCiphertext: '{"ok":true}',
      requestBodyIv: 'iv',
      requestedAt: new Date('2026-03-01T00:00:00.000Z'),
      webhookConfig: {
        id: 'config-1',
        status: 'ACTIVE',
        endpointCiphertext: 'https://example.test/webhook',
        endpointIv: 'iv',
        signingSecretCiphertext: 'super_secret_value',
        signingSecretIv: 'iv',
        timeoutSeconds: 5,
        maxRetries: 4,
        headersJson: null
      }
    });
    (global.fetch as any).mockResolvedValue(new Response('retry later', { status: 500 }));
    webhookFailureAlertFindFirst.mockResolvedValue(null);
    webhookFailureAlertCreate.mockResolvedValue({ id: 'alert-1' });
    userRoleFindMany.mockResolvedValue([{ userId: 'admin-1' }]);
    webhookLogGroupBy.mockResolvedValue([{ deliveryStatus: 'PENDING', _count: { _all: 1 } }]);

    await dispatchDueWebhookLogs({ actorRoles: ['ADMIN'], limit: 1 });

    expect(webhookLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-2' },
        data: expect.objectContaining({
          deliveryStatus: 'PENDING',
          attemptNumber: 3,
          errorMessage: 'Retryable HTTP 500'
        })
      })
    );
    expect(webhookFailureAlertCreate).toHaveBeenCalledTimes(1);
    expect(txNotificationCreate).toHaveBeenCalledTimes(1);
  });

  it('dead-letters permanent failures and acknowledges alerts', async () => {
    webhookLogFindMany.mockResolvedValue([{ id: 'log-3' }]);
    webhookLogFindUnique.mockResolvedValue({
      id: 'log-3',
      webhookConfigId: 'config-1',
      eventKey: 'booking.success',
      attemptNumber: 1,
      requestBodyCiphertext: '{"ok":true}',
      requestBodyIv: 'iv',
      requestedAt: new Date('2026-03-01T00:00:00.000Z'),
      webhookConfig: {
        id: 'config-1',
        status: 'ACTIVE',
        endpointCiphertext: 'https://example.test/webhook',
        endpointIv: 'iv',
        signingSecretCiphertext: 'super_secret_value',
        signingSecretIv: 'iv',
        timeoutSeconds: 5,
        maxRetries: 4,
        headersJson: null
      }
    });
    (global.fetch as any).mockResolvedValue(new Response('bad request', { status: 400 }));
    webhookFailureAlertFindFirst.mockResolvedValue(null);
    webhookFailureAlertCreate.mockResolvedValue({ id: 'alert-2' });
    userRoleFindMany.mockResolvedValue([{ userId: 'admin-1' }]);
    webhookLogGroupBy.mockResolvedValue([{ deliveryStatus: 'DEAD_LETTER', _count: { _all: 1 } }]);

    await dispatchDueWebhookLogs({ actorRoles: ['ADMIN'], limit: 1 });

    expect(webhookLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-3' },
        data: expect.objectContaining({
          deliveryStatus: 'DEAD_LETTER',
          errorMessage: 'Permanent HTTP failure: 400'
        })
      })
    );

    webhookFailureAlertFindUnique.mockResolvedValue({ id: 'alert-2', status: 'OPEN' });
    webhookFailureAlertUpdate.mockResolvedValue({ id: 'alert-2', status: 'ACKNOWLEDGED', acknowledgedByUserId: 'admin-1' });

    const acknowledged = await acknowledgeWebhookFailureAlert({
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
      alertId: 'alert-2'
    });

    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(webhookFailureAlertUpdate).toHaveBeenCalledTimes(1);
  });

  it('enforces query boundaries for webhook logs and alerts', async () => {
    await expect(
      queryWebhookLogs({
        actorRoles: ['ADMIN'],
        from: '2026-03-02T00:00:00.000Z',
        to: '2026-03-01T00:00:00.000Z'
      })
    ).rejects.toMatchObject<AuthError>({ statusCode: 400, message: 'to must be after from' });

    webhookLogFindMany.mockResolvedValue([]);
    const logs = await queryWebhookLogs({ actorRoles: ['ADMIN'], limit: 10 });
    expect(logs.logs).toEqual([]);

    await expect(
      queryWebhookFailureAlerts({
        actorRoles: ['ADMIN'],
        from: '2026-03-02T00:00:00.000Z',
        to: '2026-03-01T00:00:00.000Z'
      })
    ).rejects.toMatchObject<AuthError>({ statusCode: 400, message: 'to must be after from' });

    webhookFailureAlertFindMany.mockResolvedValue([]);
    const alerts = await queryWebhookFailureAlerts({ actorRoles: ['ADMIN'], limit: 5 });
    expect(alerts.alerts).toEqual([]);
  });
});
