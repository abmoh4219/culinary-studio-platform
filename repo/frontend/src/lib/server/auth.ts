import type { RequestEvent } from '@sveltejs/kit';

import type { AuthSession } from '$lib/auth/types';
import { fetchApiJson } from '$lib/server/api';

export async function fetchAuthSession(event: RequestEvent): Promise<AuthSession | null> {
  try {
    const payload = await fetchApiJson<{ user?: AuthSession['user'] }>(event, '/auth/me');
    if (!payload.user) {
      return null;
    }

    return { user: payload.user };
  } catch (_error) {
    return null;
  }
}
