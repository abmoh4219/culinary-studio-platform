import { fail, redirect } from '@sveltejs/kit';

import { fetchAuthSession } from '$lib/server/auth';
import { getFrontendConfig } from '$lib/server/config';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await fetchAuthSession(event);
  if (session) {
    throw redirect(302, '/');
  }

  const config = getFrontendConfig();

  return {
    publicApiBaseUrl: config.publicApiBaseUrl
  };
};

export const actions: Actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const username = formData.get('username')?.toString()?.trim().toLowerCase() ?? '';
    const password = formData.get('password')?.toString() ?? '';

    if (!username || username.length < 3) {
      return fail(400, { error: 'Enter your email.', username });
    }

    if (!password) {
      return fail(400, { error: 'Enter your password.', username });
    }

    const config = getFrontendConfig();
    const apiBase = config.apiInternalBaseUrl || config.publicApiBaseUrl;

    const response = await event.fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return fail(response.status, {
        error: payload.message ?? 'We could not sign you in with those credentials.',
        username
      });
    }

    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookieHeaders) {
      event.cookies.set(
        cookieName(cookie),
        cookieValue(cookie),
        parseCookieOptions(cookie)
      );
    }

    throw redirect(303, '/');
  }
};

function cookieName(raw: string): string {
  return raw.split('=')[0]?.trim() ?? '';
}

function cookieValue(raw: string): string {
  const afterEquals = raw.indexOf('=');
  const afterSemicolon = raw.indexOf(';');
  if (afterEquals < 0) return '';
  const end = afterSemicolon > afterEquals ? afterSemicolon : raw.length;
  return raw.slice(afterEquals + 1, end).trim();
}

function parseCookieOptions(raw: string): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge?: number;
} {
  const lower = raw.toLowerCase();
  const parts = raw.split(';').map((p) => p.trim().toLowerCase());

  const maxAgePart = parts.find((p) => p.startsWith('max-age='));
  const maxAge = maxAgePart ? parseInt(maxAgePart.split('=')[1], 10) : undefined;

  return {
    path: '/',
    httpOnly: lower.includes('httponly'),
    secure: lower.includes('secure'),
    sameSite: lower.includes('samesite=strict')
      ? 'strict'
      : lower.includes('samesite=none')
        ? 'none'
        : 'lax',
    ...(maxAge !== undefined && !isNaN(maxAge) ? { maxAge } : {})
  };
}
