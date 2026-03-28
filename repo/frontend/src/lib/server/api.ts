import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

type ApiEvent = Pick<RequestEvent, 'fetch' | 'request'>;

function apiBaseUrl(): string {
  return (
    privateEnv.API_INTERNAL_BASE_URL ||
    privateEnv.PUBLIC_API_BASE_URL ||
    publicEnv.PUBLIC_API_BASE_URL ||
    'http://localhost:4000/api/v1'
  );
}

export async function fetchApiJson<T>(event: ApiEvent, path: string): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';

  const response = await event.fetch(`${apiBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      cookie
    }
  });

  if (!response.ok) {
    const body = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(`${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export async function postApiJson<T>(event: ApiEvent, path: string, body: unknown): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';

  const response = await event.fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || response.statusText || 'Request failed');
  }

  return (await response.json()) as T;
}

export async function putApiJson<T>(event: ApiEvent, path: string, body: unknown): Promise<T> {
  const cookie = event.request.headers.get('cookie') ?? '';

  const response = await event.fetch(`${apiBaseUrl()}${path}`, {
    method: 'PUT',
    headers: {
      cookie,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || response.statusText || 'Request failed');
  }

  return (await response.json()) as T;
}

export function createUpcomingWindow(hoursFromNow: number, durationMinutes: number): {
  startAt: string;
  endAt: string;
} {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString()
  };
}
