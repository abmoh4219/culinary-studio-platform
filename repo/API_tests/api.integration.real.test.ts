import { createHmac, randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const runRealIntegration = process.env.RUN_REAL_INTEGRATION === 'true';

describe.runIf(runRealIntegration)('real backend integration (postgres + prisma migrations)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const backendRoot = path.join(repoRoot, 'backend');

  const sourceDatabaseUrl = process.env.REAL_INTEGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!sourceDatabaseUrl) {
    throw new Error('REAL_INTEGRATION_DATABASE_URL or DATABASE_URL is required for real integration tests');
  }

  const schemaName = `it_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const schemaUrl = new URL(sourceDatabaseUrl);
  schemaUrl.searchParams.set('schema', schemaName);
  const integrationDatabaseUrl = schemaUrl.toString();

  const adminUrl = new URL(sourceDatabaseUrl);
  adminUrl.searchParams.set('schema', 'public');
  const adminDatabaseUrl = adminUrl.toString();

  let app: any;
  let prisma: any;
  let adminPrisma: any;
  let authCookieName = 'access_token';
  let seededUserId = '';
  let seededUsername = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = integrationDatabaseUrl;
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'real_it_access_secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'real_it_refresh_secret';
    process.env.SIGNED_REQUEST_SECRET = process.env.SIGNED_REQUEST_SECRET || 'real_it_signed_request_secret';
    process.env.SIGNED_REQUEST_KEY_ID = process.env.SIGNED_REQUEST_KEY_ID || 'default';
    process.env.SECURITY_ACTION_PATH_PREFIXES = '/bookings,/billing,/invoices,/payments';
    process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'real_it_field_encryption_key_32!!';
    process.env.TRUST_PROXY = 'false';

    execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: integrationDatabaseUrl
      },
      stdio: 'pipe'
    });

    vi.resetModules();

    const [{ PrismaClient, UserStatus }, { hashPassword }, appModule, authConstants] = await Promise.all([
      import('../backend/prisma/generated'),
      import('../backend/src/modules/auth/password.service'),
      import('../backend/src/app'),
      import('../backend/src/modules/auth/auth.constants')
    ]);

    authCookieName = authConstants.AUTH_COOKIE_NAME;
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: integrationDatabaseUrl
        }
      }
    });

    adminPrisma = new PrismaClient({
      datasources: {
        db: {
          url: adminDatabaseUrl
        }
      }
    });

    const adminRole = await prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        code: 'ADMIN',
        name: 'Administrator'
      }
    });

    const passwordHash = await hashPassword('RealIntegrationPass123!');

    const seeded = await prisma.user.create({
      data: {
        username: `real-it-admin-${randomUUID().slice(0, 8)}`,
        displayName: 'Real Integration Admin',
        status: UserStatus.ACTIVE,
        passwordHash,
        consentGranted: true,
        consentGrantedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        roles: {
          create: {
            roleId: adminRole.id
          }
        }
      },
      select: {
        id: true,
        username: true
      }
    });

    seededUserId = seeded.id;

    app = appModule.buildApp();
    await app.ready();

    seededUsername = seeded.username;
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (prisma) {
      await prisma.$disconnect();
    }

    if (adminPrisma) {
      await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await adminPrisma.$disconnect();
    }
  });

  async function loginAndGetCookie(): Promise<string> {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: seededUsername,
        password: 'RealIntegrationPass123!'
      }
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().user.id).toBe(seededUserId);

    const setCookie = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie)
      ? setCookie[0].split(';')[0]
      : (setCookie || '').split(';')[0];

    expect(cookieHeader.startsWith(`${authCookieName}=`)).toBe(true);

    return cookieHeader;
  }

  async function signedHeaders(pathName: string, payload: unknown, nonce: string, idempotencyKey: string) {
    const timestamp = String(Math.floor(Date.now() / 1000));

    const { bodyHash } = await import('../backend/src/modules/security/security.utils');
    const canonical = ['POST', pathName, timestamp, nonce, seededUserId, bodyHash(payload)].join('\n');
    const signature = createHmac('sha256', process.env.SIGNED_REQUEST_SECRET || '')
      .update(canonical)
      .digest('hex');

    return {
      'content-type': 'application/json',
      'x-key-id': process.env.SIGNED_REQUEST_KEY_ID || 'default',
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': signature,
      'idempotency-key': idempotencyKey
    };
  }

  it('logs in and performs a real signed protected billing mutation', async () => {
    const cookieHeader = await loginAndGetCookie();

    const pathName = '/api/v1/billing/wallet/top-up';
    const payload = {
      userId: seededUserId,
      amount: 25,
      currency: 'USD',
      reason: 'real integration top-up'
    };

    const headers = await signedHeaders(pathName, payload, `real-it-${Date.now()}`, `real-it-idem-${Date.now()}`);

    const mutation = await app.inject({
      method: 'POST',
      url: pathName,
      headers: {
        cookie: cookieHeader,
        ...headers
      },
      payload
    });

    expect(mutation.statusCode).toBe(200);
    expect(mutation.json().wallet.userId).toBe(seededUserId);
  }, 120000);

  it('executes full booking lifecycle with real DB state and cancellation fee', async () => {
    const cookieHeader = await loginAndGetCookie();

    const startAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    const createPath = '/api/v1/bookings';
    const createPayload = {
      sessionKey: 'real.integration.class',
      seatKey: 'station-1',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 1,
      partySize: 1
    };

    const create = await app.inject({
      method: 'POST',
      url: createPath,
      headers: {
        cookie: cookieHeader,
        ...(await signedHeaders(createPath, createPayload, `real-it-book-${Date.now()}`, `real-it-book-idem-${Date.now()}`))
      },
      payload: createPayload
    });

    expect(create.statusCode).toBe(201);
    const bookingId = create.json().booking.id as string;
    expect(bookingId).toBeTruthy();

    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/bookings/${bookingId}/cancellation-preview?baseAmount=100`,
      headers: {
        cookie: cookieHeader
      }
    });

    expect(preview.statusCode).toBe(200);
    expect(preview.json().preview.feePercent).toBe(50);

    const confirmPath = `/api/v1/bookings/${bookingId}/cancel-confirm`;
    const confirmPayload = {
      capacity: 1,
      baseAmount: 100
    };

    const cancelConfirm = await app.inject({
      method: 'POST',
      url: confirmPath,
      headers: {
        cookie: cookieHeader,
        ...(await signedHeaders(confirmPath, confirmPayload, `real-it-cancel-${Date.now()}`, `real-it-cancel-idem-${Date.now()}`))
      },
      payload: confirmPayload
    });

    expect(cancelConfirm.statusCode).toBe(200);
    expect(cancelConfirm.json().feePreview.feePercent).toBe(50);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true
      }
    });

    expect(booking?.status, 'Booking status should be persisted as canceled').toBe('CANCELED');
  }, 120000);
});
