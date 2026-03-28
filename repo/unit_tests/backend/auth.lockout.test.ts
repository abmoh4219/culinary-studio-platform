import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    username: 'member@example.com',
    displayName: 'Member',
    status: 'ACTIVE',
    passwordHash: 'hash',
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
    consentGranted: true,
    consentGrantedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z')
  }
}));

vi.mock('../../backend/src/modules/auth/password.service', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ ...state.user })),
      update: vi.fn(async ({ data }: any) => {
        if (data.failedLoginAttempts !== undefined) {
          state.user.failedLoginAttempts = data.failedLoginAttempts;
        }
        if (data.lockedUntil !== undefined) {
          state.user.lockedUntil = data.lockedUntil;
        }
        return { ...state.user };
      })
    },
    userRole: {
      findMany: vi.fn(async () => [{ role: { code: 'MEMBER' } }])
    },
    role: {
      findUnique: vi.fn()
    }
  }
}));

import { verifyPassword } from '../../backend/src/modules/auth/password.service';
import { AuthError, loginUser } from '../../backend/src/modules/auth/auth.service';

describe('auth lockout policy', () => {
  beforeEach(() => {
    process.env.AUTH_LOCK_MAX_ATTEMPTS = '10';
    process.env.AUTH_LOCK_DURATION_MINUTES = '15';
    state.user.failedLoginAttempts = 0;
    state.user.lockedUntil = null;
    vi.mocked(verifyPassword).mockReset();
  });

  it('locks account after 10 failed login attempts and returns 423 while locked', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    for (let i = 0; i < 10; i += 1) {
      await expect(loginUser({ username: 'member@example.com', password: 'bad-pass' })).rejects.toThrow(AuthError);
    }

    expect(state.user.lockedUntil).not.toBeNull();

    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(loginUser({ username: 'member@example.com', password: 'good-pass' })).rejects.toMatchObject({
      statusCode: 423
    });
  });

  it('unlocks after lock window expires and allows successful login', async () => {
    state.user.lockedUntil = new Date(Date.now() - 60_000);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await loginUser({ username: 'member@example.com', password: 'good-pass' });

    expect(result.id).toBe('user-1');
    expect(state.user.failedLoginAttempts).toBe(0);
    expect(state.user.lockedUntil).toBeNull();
  });
});
