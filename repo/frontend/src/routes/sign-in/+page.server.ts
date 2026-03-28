import { redirect } from '@sveltejs/kit';

import { fetchAuthSession } from '$lib/server/auth';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await fetchAuthSession(event);
  if (session) {
    throw redirect(302, '/');
  }

  return {};
};
