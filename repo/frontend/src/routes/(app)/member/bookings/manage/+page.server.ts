import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { fetchApiJson, postApiJson } from '$lib/server/api';

import type { Actions, PageServerLoad } from './$types';

type CancellationPreviewResponse = {
  bookingId: string;
  preview: {
    policyBand: string;
    feePercent: number;
    feeAmount: number;
    baseAmount: number;
    hoursBeforeStart: number;
    generatedAt: string;
  };
};

export const load: PageServerLoad = async ({ url }) => {
  return {
    bookingId: url.searchParams.get('bookingId') ?? ''
  };
};

function numberFromForm(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function textFromForm(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function failWith(action: string, message: string, fields?: Record<string, string>) {
  return fail(400, {
    action,
    success: false,
    message,
    fields
  });
}

async function previewCancellation(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = textFromForm(formData, 'bookingId');
  const baseAmount = numberFromForm(formData, 'baseAmount');

  if (!bookingId) {
    return failWith('previewCancellation', 'Booking ID is required.', { bookingId: 'Required' });
  }

  const query = baseAmount !== null ? `?baseAmount=${encodeURIComponent(String(baseAmount))}` : '';

  try {
    const response = await fetchApiJson<CancellationPreviewResponse>(
      event,
      `/bookings/${encodeURIComponent(bookingId)}/cancellation-preview${query}`
    );

    return {
      action: 'previewCancellation',
      success: true,
      preview: response
    };
  } catch (error) {
    return failWith('previewCancellation', (error as Error).message);
  }
}

async function confirmCancellation(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = textFromForm(formData, 'bookingId');
  const capacity = numberFromForm(formData, 'capacity');
  const baseAmount = numberFromForm(formData, 'baseAmount');

  if (!bookingId) {
    return failWith('confirmCancellation', 'Booking ID is required.', { bookingId: 'Required' });
  }

  if (capacity === null || capacity <= 0) {
    return failWith('confirmCancellation', 'Capacity must be a positive number.', { capacity: 'Invalid capacity' });
  }

  try {
    const result = await postApiJson<{
      canceledBookingId: string;
      feePreview: {
        policyBand: string;
        feePercent: number;
        feeAmount: number;
        baseAmount: number;
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
    return failWith('confirmCancellation', (error as Error).message);
  }
}

async function reschedule(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = textFromForm(formData, 'bookingId');
  const newSessionKey = textFromForm(formData, 'newSessionKey');
  const newSeatKey = textFromForm(formData, 'newSeatKey');
  const newStartAt = textFromForm(formData, 'newStartAt');
  const newEndAt = textFromForm(formData, 'newEndAt');
  const capacity = numberFromForm(formData, 'capacity');

  const fields: Record<string, string> = {};
  if (!bookingId) fields.bookingId = 'Required';
  if (!newSessionKey) fields.newSessionKey = 'Required';
  if (!newSeatKey) fields.newSeatKey = 'Required';
  if (!newStartAt) fields.newStartAt = 'Required';
  if (!newEndAt) fields.newEndAt = 'Required';
  if (capacity === null || capacity <= 0) fields.capacity = 'Invalid';

  if (Object.keys(fields).length > 0) {
    return failWith('reschedule', 'Please fix highlighted fields.', fields);
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
      action: 'reschedule',
      success: true,
      reschedule: result
    };
  } catch (error) {
    return failWith('reschedule', (error as Error).message);
  }
}

export const actions: Actions = {
  previewCancellation,
  confirmCancellation,
  reschedule
};
