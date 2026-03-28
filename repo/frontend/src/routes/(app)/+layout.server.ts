import { redirect } from '@sveltejs/kit';

import { fetchAuthSession } from '$lib/server/auth';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const session = await fetchAuthSession(event);

  if (!session) {
    throw redirect(302, '/sign-in');
  }

  return {
    session
  };
};
