import { createHash } from 'node:crypto';

import { UserStatus } from '../../../prisma/generated';
import { getConfig } from '../../lib/config';
import { prisma } from '../../lib/prisma';

import { hashPassword, verifyPassword } from './password.service';

type RegisterInput = {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  consentGranted: boolean;
};

type LoginInput = {
  username: string;
  password: string;
};

type SafeUser = {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  consentGranted: boolean;
  consentGrantedAt: Date | null;
  createdAt: Date;
  roles: string[];
};

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function lockoutConfig() {
  const config = getConfig();
  return {
    maxAttempts: parsePositiveInt(String(config.AUTH_LOCK_MAX_ATTEMPTS), 10),
    lockMinutes: parsePositiveInt(String(config.AUTH_LOCK_DURATION_MINUTES), 15)
  };
}

function sanitizeUser(user: SafeUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    consentGranted: user.consentGranted,
    consentGrantedAt: user.consentGrantedAt,
    createdAt: user.createdAt,
    roles: user.roles
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string | undefined, username: string): string {
  const value = displayName?.trim();
  return value && value.length > 0 ? value : username;
}

function normalizeEmail(email: string | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value && value.length > 0 ? value : null;
}

function validateRegisterInput(input: RegisterInput): void {
  if (input.username.trim().length < 3 || input.username.trim().length > 50) {
    throw new AuthError('Username must be between 3 and 50 characters', 400);
  }

  if (input.password.length < 12) {
    throw new AuthError('Password must be at least 12 characters', 400);
  }

  if (!input.consentGranted) {
    throw new AuthError('Consent is required for registration', 400);
  }
}

async function getRoleCodes(userId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          code: true
        }
      }
    }
  });

  return roles.map((entry) => entry.role.code);
}

export async function registerUser(input: RegisterInput) {
  validateRegisterInput(input);

  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  const displayName = normalizeDisplayName(input.displayName, username);

  const existingByUsername = await prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });

  if (existingByUsername) {
    throw new AuthError('Username is already in use', 409);
  }

  const emailHash = email ? sha256(email) : null;
  if (emailHash) {
    const existingByEmail = await prisma.user.findUnique({
      where: { emailHash },
      select: { id: true }
    });
    if (existingByEmail) {
      throw new AuthError('Email is already in use', 409);
    }
  }

  const passwordHash = await hashPassword(input.password);
  const defaultRole =
    (await prisma.role.findUnique({
      where: { code: 'MEMBER' },
      select: { id: true }
    })) ||
    (await prisma.role.findUnique({
      where: { code: 'USER' },
      select: { id: true }
    }));

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      emailHash,
      passwordHash,
      consentGranted: true,
      consentGrantedAt: new Date(),
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      status: true,
      consentGranted: true,
      consentGrantedAt: true,
      createdAt: true
    }
  });

  if (defaultRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: defaultRole.id
      }
    });
  }

  const roles = await getRoleCodes(user.id);
  return sanitizeUser({ ...user, roles });
}

async function incrementFailedAttempts(userId: string, currentAttempts: number): Promise<void> {
  const { maxAttempts, lockMinutes } = lockoutConfig();
  const newAttempts = currentAttempts + 1;
  const shouldLock = newAttempts >= maxAttempts;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: shouldLock ? 0 : newAttempts,
      lockedUntil: shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000) : null
    }
  });
}

export async function loginUser(input: LoginInput) {
  const username = normalizeUsername(input.username);

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      status: true,
      passwordHash: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      consentGranted: true,
      consentGrantedAt: true,
      createdAt: true
    }
  });

  if (!user?.passwordHash) {
    throw new AuthError('Invalid credentials', 401);
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AuthError('Account is temporarily locked. Try again later.', 423);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AuthError('Account is not active', 403);
  }

  const validPassword = await verifyPassword(user.passwordHash, input.password);
  if (!validPassword) {
    await incrementFailedAttempts(user.id, user.failedLoginAttempts);
    throw new AuthError('Invalid credentials', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null
    }
  });

  const roles = await getRoleCodes(user.id);
  return sanitizeUser({ ...user, roles });
}

export async function getUserConsentRecord(actorRoles: string[], userId: string) {
  if (!actorRoles.includes('ADMIN')) {
    throw new AuthError('Only admins can read consent records', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      consentGranted: true,
      consentGrantedAt: true,
      status: true
    }
  });

  if (!user) {
    throw new AuthError('User not found', 404);
  }

  return {
    user
  };
}

export async function updateUserConsentRecord(input: {
  actorRoles: string[];
  userId: string;
  consentGranted: boolean;
}) {
  if (!input.actorRoles.includes('ADMIN')) {
    throw new AuthError('Only admins can update consent records', 403);
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      consentGranted: input.consentGranted,
      consentGrantedAt: input.consentGranted ? new Date() : null
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      consentGranted: true,
      consentGrantedAt: true,
      status: true
    }
  });

  return {
    user: updated
  };
}
