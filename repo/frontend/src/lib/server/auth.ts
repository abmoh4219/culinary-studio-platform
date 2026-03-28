import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

import type { AuthSession } from '$lib/auth/types';

export async function fetchAuthSession(event: RequestEvent): Promise<AuthSession | null> {
  const apiBaseUrl = env.PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';
  const cookie = event.request.headers.get('cookie') ?? '';
  const response = await event.fetch(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: {
      cookie
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user?: AuthSession['user'] };
  if (!payload.user) {
    return null;
  }

  return { user: payload.user };
}
