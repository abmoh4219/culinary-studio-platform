import { fail } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoad } from '@sveltejs/kit';

import { fetchApiJson, putApiJson } from '$lib/server/api';

type NotificationHistoryResponse = {
  userId: string;
  filters: {
    scenario: string | null;
    status: string | null;
    from: string | null;
    to: string | null;
    limit: number;
  };
  notifications: Array<{
    id: string;
    userId: string;
    scenario: string;
    channel: string;
    status: string;
    subject: string | null;
    scheduledFor: string | null;
    sentAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    createdAt: string;
    payloadJson?: Record<string, unknown> | null;
  }>;
};

type NotificationPreference = {
  id: string;
  userId: string;
  globalMuted: boolean;
  mutedCategories: string[];
  updatedAt: string;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export const load: ServerLoad = async (event: RequestEvent) => {
  const params = event.url.searchParams;
  const query = new URLSearchParams();

  for (const key of ['scenario', 'status', 'from', 'to', 'limit']) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';

  const [history, preference] = await Promise.all([
    fetchApiJson<NotificationHistoryResponse>(event, `/notifications/history${suffix}`),
    fetchApiJson<NotificationPreference>(event, '/notifications/preferences')
  ]);

  return {
    history,
    preference,
    filterValues: {
      scenario: params.get('scenario') ?? '',
      status: params.get('status') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      limit: params.get('limit') ?? String(history.filters.limit)
    }
  };
};

export const actions: Actions = {
  updatePreferences: async (event: RequestEvent) => {
    const formData = await event.request.formData();

    try {
      const preference = await putApiJson<NotificationPreference>(event, '/notifications/preferences', {
        globalMuted: formData.get('globalMuted') === 'on',
        mutedCategories: formData.getAll('mutedCategories').map((value: FormDataEntryValue) => String(value))
      });

      return {
        action: 'updatePreferences',
        success: true,
        preference
      };
    } catch (error) {
      return fail(400, {
        action: 'updatePreferences',
        success: false,
        message: (error as Error).message
      });
    }
  },
  refresh: async () => {
    return {
      action: 'refresh',
      success: true,
      refreshedAt: new Date().toISOString()
    };
  }
};
