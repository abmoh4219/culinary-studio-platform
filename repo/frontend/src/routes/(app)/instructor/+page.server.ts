import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { fetchApiJson, postApiJson } from '$lib/server/api';

import type { Actions, PageServerLoad } from './$types';

type ActiveRunsResponse = {
  runs: Array<{
    id: string;
    recipeId: string;
    bookingId: string | null;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    currentPhaseNumber: number | null;
    startedAt: string | null;
    updatedAt: string;
  }>;
};

type RunStateResponse = {
  run: {
    id: string;
    recipeId: string;
    bookingId: string | null;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    currentPhaseNumber: number | null;
    startedAt: string | null;
    steps: Array<{
      id: string;
      recipeStepId: string;
      phaseNumber: number;
      positionInPhase: number;
      titleSnapshot: string;
      status: 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'CANCELED' | 'FAILED';
    }>;
  };
  progress: {
    totalSteps: number;
    completedSteps: number;
    skippedSteps: number;
    terminalSteps: number;
    nextTimerAt: string | null;
  };
};

type AvailabilityResponse = {
  sessionKey: string;
  startAt: string;
  endAt: string;
  capacity: number;
  activeBookings: number;
  remainingCapacity: number;
  isBookableNow: boolean;
};

type WaitlistResponse = {
  entries: Array<{
    id: string;
    userId: string;
    queuePosition: number;
    status: 'WAITING' | 'OFFERED' | 'CONVERTED';
    bookingId: string | null;
    createdAt: string;
  }>;
};

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readNumber(formData: FormData, key: string): number | null {
  const raw = readText(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function actionFail(action: string, message: string, fields?: Record<string, string>) {
  return fail(400, {
    action,
    success: false,
    message,
    fields
  });
}

async function loadMonitoring(event: RequestEvent) {
  const sessionKey = event.url.searchParams.get('sessionKey') ?? '';
  const startAt = event.url.searchParams.get('startAt') ?? '';
  const endAt = event.url.searchParams.get('endAt') ?? '';
  const capacityRaw = event.url.searchParams.get('capacity') ?? '';
  const capacity = Number(capacityRaw);

  if (!sessionKey || !startAt || !endAt || !Number.isFinite(capacity) || capacity <= 0) {
    return {
      params: {
        sessionKey,
        startAt,
        endAt,
        capacity: capacityRaw
      },
      availability: null,
      waitlist: null,
      error: null as string | null
    };
  }

  try {
    const availability = await fetchApiJson<AvailabilityResponse>(
      event,
      `/bookings/availability?sessionKey=${encodeURIComponent(sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}&capacity=${capacity}`
    );
    const waitlist = await fetchApiJson<WaitlistResponse>(
      event,
      `/bookings/waitlist?sessionKey=${encodeURIComponent(sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
    );

    return {
      params: {
        sessionKey,
        startAt,
        endAt,
        capacity: String(capacity)
      },
      availability,
      waitlist,
      error: null as string | null
    };
  } catch (error) {
    return {
      params: {
        sessionKey,
        startAt,
        endAt,
        capacity: String(capacity)
      },
      availability: null,
      waitlist: null,
      error: (error as Error).message
    };
  }
}

export const load: PageServerLoad = async (event: RequestEvent) => {
  const active = await fetchApiJson<ActiveRunsResponse>(event, '/workflows/runs/active').catch(() => ({ runs: [] }));

  const selectedRunId = event.url.searchParams.get('runId') ?? active.runs[0]?.id ?? '';
  const selectedRun = selectedRunId
    ? await fetchApiJson<RunStateResponse>(event, `/workflows/runs/${encodeURIComponent(selectedRunId)}`).catch(() => null)
    : null;

  const monitoring = await loadMonitoring(event);

  return {
    activeRuns: active.runs,
    selectedRunId,
    selectedRun,
    monitoring
  };
};

async function createClassRun(event: RequestEvent) {
  const formData = await event.request.formData();
  const recipeId = readText(formData, 'recipeId');
  const bookingId = readText(formData, 'bookingId');

  if (!recipeId) {
    return actionFail('createClassRun', 'Recipe ID is required.', { recipeId: 'Required' });
  }

  try {
    const result = await postApiJson<RunStateResponse>(event, '/workflows/runs', {
      recipeId,
      bookingId: bookingId || undefined
    });

    return {
      action: 'createClassRun',
      success: true,
      run: result.run
    };
  } catch (error) {
    return actionFail('createClassRun', (error as Error).message);
  }
}

async function runControl(event: RequestEvent) {
  const formData = await event.request.formData();
  const runId = readText(formData, 'runId');
  const actionKind = readText(formData, 'actionKind');
  const runStepId = readText(formData, 'runStepId');
  const reason = readText(formData, 'reason');

  if (!runId || !actionKind) {
    return actionFail('runControl', 'Run action payload is incomplete.');
  }

  const allowed = new Set(['pause', 'resume', 'tick', 'complete', 'rollback']);
  if (!allowed.has(actionKind)) {
    return actionFail('runControl', 'Unknown run action requested.');
  }

  try {
    let path = `/workflows/runs/${encodeURIComponent(runId)}`;
    let body: Record<string, unknown> | undefined = undefined;

    if (actionKind === 'pause' || actionKind === 'resume' || actionKind === 'tick') {
      path = `${path}/${actionKind}`;
    }

    if (actionKind === 'complete') {
      if (!runStepId) return actionFail('runControl', 'Step ID required for complete.');
      path = `${path}/steps/${encodeURIComponent(runStepId)}/complete`;
    }

    if (actionKind === 'rollback') {
      if (!runStepId) return actionFail('runControl', 'Step ID required for rollback.');
      path = `${path}/steps/${encodeURIComponent(runStepId)}/rollback`;
      body = {
        reason: reason || 'Instructor rollback from class management workspace'
      };
    }

    const result = await postApiJson<RunStateResponse>(event, path, body ?? {});

    return {
      action: 'runControl',
      success: true,
      actionKind,
      run: result.run,
      progress: result.progress
    };
  } catch (error) {
    return actionFail('runControl', (error as Error).message);
  }
}

async function rescheduleSession(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = readText(formData, 'bookingId');
  const newSessionKey = readText(formData, 'newSessionKey');
  const newSeatKey = readText(formData, 'newSeatKey');
  const newStartAt = readText(formData, 'newStartAt');
  const newEndAt = readText(formData, 'newEndAt');
  const capacity = readNumber(formData, 'capacity');

  const fields: Record<string, string> = {};
  if (!bookingId) fields.bookingId = 'Required';
  if (!newSessionKey) fields.newSessionKey = 'Required';
  if (!newSeatKey) fields.newSeatKey = 'Required';
  if (!newStartAt) fields.newStartAt = 'Required';
  if (!newEndAt) fields.newEndAt = 'Required';
  if (capacity === null || capacity <= 0) fields.capacity = 'Invalid';

  if (Object.keys(fields).length > 0) {
    return actionFail('rescheduleSession', 'Please fix highlighted fields.', fields);
  }

  try {
    const result = await postApiJson<{
      booking: {
        id: string;
        sessionKey: string;
        seatKey: string;
        startAt: string;
        endAt: string;
      };
    }>(event, `/bookings/${encodeURIComponent(bookingId)}/reschedule`, {
      newSessionKey,
      newSeatKey,
      newStartAt,
      newEndAt,
      capacity
    });

    return {
      action: 'rescheduleSession',
      success: true,
      reschedule: result
    };
  } catch (error) {
    return actionFail('rescheduleSession', (error as Error).message);
  }
}

async function previewCancellation(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = readText(formData, 'bookingId');
  const baseAmount = readNumber(formData, 'baseAmount');

  if (!bookingId) {
    return actionFail('previewCancellation', 'Booking ID is required.', { bookingId: 'Required' });
  }

  try {
    const query = baseAmount !== null ? `?baseAmount=${encodeURIComponent(String(baseAmount))}` : '';
    const result = await fetchApiJson<{
      bookingId: string;
      preview: {
        policyBand: string;
        feePercent: number;
        feeAmount: number;
        baseAmount: number;
      };
    }>(event, `/bookings/${encodeURIComponent(bookingId)}/cancellation-preview${query}`);

    return {
      action: 'previewCancellation',
      success: true,
      preview: result
    };
  } catch (error) {
    return actionFail('previewCancellation', (error as Error).message);
  }
}

async function confirmCancellation(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = readText(formData, 'bookingId');
  const capacity = readNumber(formData, 'capacity');
  const baseAmount = readNumber(formData, 'baseAmount');

  if (!bookingId) {
    return actionFail('confirmCancellation', 'Booking ID is required.', { bookingId: 'Required' });
  }

  if (capacity === null || capacity <= 0) {
    return actionFail('confirmCancellation', 'Capacity must be a positive number.', { capacity: 'Invalid' });
  }

  try {
    const result = await postApiJson<{
      canceledBookingId: string;
      feePreview: {
        policyBand: string;
        feePercent: number;
        feeAmount: number;
      };
    }>(event, `/bookings/${encodeURIComponent(bookingId)}/cancel-confirm`, {
      capacity,
      baseAmount: baseAmount ?? undefined
    });

    return {
      action: 'confirmCancellation',
      success: true,
      cancellation: result
    };
  } catch (error) {
    return actionFail('confirmCancellation', (error as Error).message);
  }
}

export const actions: Actions = {
  createClassRun,
  runControl,
  rescheduleSession,
  previewCancellation,
  confirmCancellation
};
