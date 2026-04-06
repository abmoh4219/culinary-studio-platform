import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    $queryRaw: queryRaw
  }
}));

vi.mock('ioredis', () => ({
  default: class MockRedis {
    async connect() {
      return undefined;
    }

    async ping() {
      return 'PONG';
    }

    disconnect() {
      return undefined;
    }
  }
}));

import { buildApp } from '../../backend/src/app';
import { resetEnvCache } from '../../backend/src/config/env';

describe('tenant isolation', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.NODE_ENV = 'development';
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    resetEnvCache();
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    resetEnvCache();
  });

  it('schema includes tenantId on core models', () => {
    const schemaPath = resolve(__dirname, '../../backend/prisma/schema.prisma');
    const schema = readFileSync(schemaPath, 'utf-8');

    expect(schema).toContain('model Tenant');
    expect(schema).toMatch(/model User[\s\S]*?tenantId/);
    expect(schema).toMatch(/model Booking[\s\S]*?tenantId/);
    expect(schema).toMatch(/model Invoice[\s\S]*?tenantId/);
    expect(schema).toMatch(/model WorkflowRun[\s\S]*?tenantId/);
    expect(schema).toMatch(/model Notification[\s\S]*?tenantId/);
    expect(schema).toMatch(/model WebhookConfig[\s\S]*?tenantId/);
  });

  it('JWT payload includes tenantId', async () => {
    const token = app.jwt.sign({
      sub: 'user-1',
      username: 'testuser',
      roles: ['MEMBER'],
      tenantId: 'tenant-abc'
    });

    const decoded = app.jwt.verify<{ sub: string; tenantId?: string }>(token);
    expect(decoded.tenantId).toBe('tenant-abc');
  });

  it('tenant context is available in authenticated request', async () => {
    const token = app.jwt.sign({
      sub: 'user-1',
      username: 'testuser',
      roles: ['MEMBER'],
      tenantId: 'tenant-abc'
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        cookie: `access_token=${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.tenantId).toBe('tenant-abc');
  });

  it('migration file exists for tenant isolation', () => {
    const migrationPath = resolve(
      __dirname,
      '../../backend/prisma/migrations/20260406120000_add_tenant_isolation/migration.sql'
    );
    const sql = readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE "Tenant"');
    expect(sql).toContain('"tenantId" UUID');
    expect(sql).toContain('ALTER TABLE "User"');
    expect(sql).toContain('ALTER TABLE "Booking"');
    expect(sql).toContain('ALTER TABLE "Invoice"');
  });
});
