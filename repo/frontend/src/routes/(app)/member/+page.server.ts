import { loadMemberWorkspace } from '$lib/server/member-workspace';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const categories = await loadMemberWorkspace(event);

  return {
    categories
  };
};
