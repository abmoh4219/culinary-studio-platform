import type { CookieSerializeOptions } from '@fastify/cookie';
import { getConfig } from '../../lib/config';

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
  const config = getConfig();
  const maxAge = parseDurationToSeconds(config.JWT_ACCESS_EXPIRES_IN, 15 * 60);

  return {
    httpOnly: true,
    secure: config.AUTH_COOKIE_SECURE,
    sameSite: config.AUTH_COOKIE_SAME_SITE,
    path: '/',
    maxAge
  };
}
