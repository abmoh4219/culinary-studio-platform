import { error } from '@sveltejs/kit';

import { getOfferingBySlug } from '$lib/member/offerings';
import { resolveOfferingLiveData } from '$lib/server/member-workspace';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const offering = getOfferingBySlug(event.params.slug);

  if (!offering) {
    throw error(404, 'Offering not found');
  }

  const live = await resolveOfferingLiveData(event, offering);

  return {
    offering,
    live
  };
};
