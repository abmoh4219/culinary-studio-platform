import type { CookieSerializeOptions } from '@fastify/cookie';

export const AUTH_COOKIE_NAME = 'access_token';

function parseDurationToSeconds(value: string | undefined, fallbackSeconds: number): number {
  if (!value) {
    return fallbackSeconds;
  }

  const trimmed = value.trim();
  const direct = Number(trimmed);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.floor(direct);
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === 's') {
    return amount;
  }
  if (unit === 'm') {
    return amount * 60;
  }
  if (unit === 'h') {
    return amount * 60 * 60;
  }

  return amount * 24 * 60 * 60;
}

export function getAuthCookieOptions(): CookieSerializeOptions {
  const secure = process.env.NODE_ENV === 'production' || process.env.AUTH_COOKIE_SECURE === 'true';
  const maxAge = parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60);

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge
  };
}
