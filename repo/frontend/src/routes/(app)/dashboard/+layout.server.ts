import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { fetchAuthSession } from '$lib/server/auth';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event: RequestEvent) => {
  const session = await fetchAuthSession(event);

  if (!session) {
    throw redirect(302, '/sign-in');
  }

  const allowed = session.user.roles.includes('ADMIN');
  if (!allowed) {
    throw redirect(302, '/forbidden');
  }

  return { session };
};
