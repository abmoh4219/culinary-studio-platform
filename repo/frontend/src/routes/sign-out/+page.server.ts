import { redirect } from '@sveltejs/kit';

import { getFrontendConfig } from '$lib/server/config';

import type { Actions } from './$types';

export const actions: Actions = {
  default: async (event) => {
    const config = getFrontendConfig();
    const apiBase = config.apiInternalBaseUrl || config.publicApiBaseUrl;

    await event.fetch(`${apiBase}/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: event.request.headers.get('cookie') ?? ''
      }
    }).catch(() => {});

    event.cookies.delete('access_token', { path: '/' });

    throw redirect(303, '/sign-in');
  }
};
