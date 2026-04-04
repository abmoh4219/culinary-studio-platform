import type { RequestEvent } from '@sveltejs/kit';

import { fetchApiJson } from '$lib/server/api';
import { getFrontendConfig } from '$lib/server/config';

export const load = async (event: RequestEvent) => {
  const from = event.url.searchParams.get('from')?.trim() || '';
  const to = event.url.searchParams.get('to')?.trim() || '';
  const userId = event.url.searchParams.get('userId')?.trim() || '';
  const limit = event.url.searchParams.get('limit')?.trim() || '20';

  const query = [
    from ? `from=${encodeURIComponent(from)}` : '',
    to ? `to=${encodeURIComponent(to)}` : '',
    `limit=${encodeURIComponent(limit)}`
  ]
    .filter(Boolean)
    .join('&');

  const workflowQuery = [
    from ? `from=${encodeURIComponent(from)}` : '',
    to ? `to=${encodeURIComponent(to)}` : '',
    userId ? `userId=${encodeURIComponent(userId)}` : ''
  ]
    .filter(Boolean)
    .join('&');

  const [viewVolume, cuisineInterest, weeklyStreaks, difficultyProgression, completionAccuracy] = await Promise.all([
    fetchApiJson(event, `/analytics/recipes/view-volume?${query}`).catch(() => null),
    fetchApiJson(event, `/analytics/recipes/cuisine-interest?${query}`).catch(() => null),
    fetchApiJson(event, `/analytics/workflows/weekly-streaks?${workflowQuery}`).catch(() => null),
    fetchApiJson(event, `/analytics/workflows/difficulty-progression?${workflowQuery}`).catch(() => null),
    fetchApiJson(event, `/analytics/workflows/completion-accuracy?${workflowQuery}`).catch(() => null)
  ]);

  const apiBaseUrl = getFrontendConfig().publicApiBaseUrl;

  const exportQuery = [
    from ? `from=${encodeURIComponent(from)}` : '',
    to ? `to=${encodeURIComponent(to)}` : '',
    userId ? `userId=${encodeURIComponent(userId)}` : ''
  ]
    .filter(Boolean)
    .join('&');

  const datasetExports = [
    {
      key: 'recipe_view_volume',
      label: 'Recipe View Volume CSV',
      href: `${apiBaseUrl}/analytics/exports/recipe_view_volume.csv${exportQuery ? `?${exportQuery}` : ''}`
    },
    {
      key: 'cuisine_interest',
      label: 'Cuisine Interest CSV',
      href: `${apiBaseUrl}/analytics/exports/cuisine_interest.csv${exportQuery ? `?${exportQuery}` : ''}`
    },
    {
      key: 'weekly_streaks',
      label: 'Weekly Streaks CSV',
      href: `${apiBaseUrl}/analytics/exports/weekly_streaks.csv${exportQuery ? `?${exportQuery}` : ''}`
    },
    {
      key: 'difficulty_progression',
      label: 'Difficulty Progression CSV',
      href: `${apiBaseUrl}/analytics/exports/difficulty_progression.csv${exportQuery ? `?${exportQuery}` : ''}`
    },
    {
      key: 'completion_accuracy',
      label: 'Completion Accuracy CSV',
      href: `${apiBaseUrl}/analytics/exports/completion_accuracy.csv${exportQuery ? `?${exportQuery}` : ''}`
    }
  ];

  return {
    filters: { from, to, userId, limit },
    datasetExports,
    viewVolume,
    cuisineInterest,
    weeklyStreaks,
    difficultyProgression,
    completionAccuracy
  };
};
