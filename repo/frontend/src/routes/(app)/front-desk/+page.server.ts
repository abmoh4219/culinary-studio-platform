import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { fetchApiJson, postApiJson } from '$lib/server/api';

import type { Actions, PageServerLoad } from './$types';

type AvailabilityResponse = {
  sessionKey: string;
  startAt: string;
  endAt: string;
  opensAt: string;
  isOpen: boolean;
  capacity: number;
  activeBookings: number;
  remainingCapacity: number;
  isBookableNow: boolean;
};

type WaitlistResponse = {
  sessionKey: string;
  startAt: string;
  endAt: string;
  entries: Array<{
    id: string;
    userId: string;
    queuePosition: number;
    status: 'WAITING' | 'OFFERED' | 'CONVERTED';
    offeredAt: string | null;
    convertedAt: string | null;
    bookingId: string | null;
    createdAt: string;
  }>;
};

type ReceivablesResponse = {
  userId: string;
  totalOutstanding: number;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    issuedAt: string | null;
    dueAt: string | null;
    currency: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    isOverdue: boolean;
  }>;
};

type OutstandingResponse = {
  id: string;
  invoiceNumber: string;
  currency: string;
  status: string;
  dueAt: string | null;
  outstanding: {
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    isOverdue: boolean;
  };
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function numberOrNull(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
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

async function loadDeskData(event: RequestEvent) {
  const sessionKey = event.url.searchParams.get('sessionKey') ?? '';
  const startAt = event.url.searchParams.get('startAt') ?? '';
  const endAt = event.url.searchParams.get('endAt') ?? '';
  const capacity = event.url.searchParams.get('capacity') ?? '';
  const userId = event.url.searchParams.get('userId') ?? '';
  const invoiceId = event.url.searchParams.get('invoiceId') ?? '';

  let availability: AvailabilityResponse | null = null;
  let waitlist: WaitlistResponse | null = null;
  let receivables: ReceivablesResponse | null = null;
  let outstanding: OutstandingResponse | null = null;
  const errors: string[] = [];

  if (sessionKey && startAt && endAt && Number.isFinite(Number(capacity)) && Number(capacity) > 0) {
    try {
      availability = await fetchApiJson<AvailabilityResponse>(
        event,
        `/bookings/availability?sessionKey=${encodeURIComponent(sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}&capacity=${encodeURIComponent(capacity)}`
      );
    } catch (error) {
      errors.push(`Availability: ${(error as Error).message}`);
    }

    try {
      waitlist = await fetchApiJson<WaitlistResponse>(
        event,
        `/bookings/waitlist?sessionKey=${encodeURIComponent(sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
      );
    } catch (error) {
      errors.push(`Waitlist: ${(error as Error).message}`);
    }
  }

  if (userId) {
    try {
      receivables = await fetchApiJson<ReceivablesResponse>(
        event,
        `/billing/receivables?userId=${encodeURIComponent(userId)}`
      );
    } catch (error) {
      errors.push(`Receivables: ${(error as Error).message}`);
    }
  }

  if (invoiceId) {
    try {
      outstanding = await fetchApiJson<OutstandingResponse>(
        event,
        `/billing/invoices/${encodeURIComponent(invoiceId)}/outstanding`
      );
    } catch (error) {
      errors.push(`Invoice outstanding: ${(error as Error).message}`);
    }
  }

  return {
    params: {
      sessionKey,
      startAt,
      endAt,
      capacity,
      userId,
      invoiceId
    },
    availability,
    waitlist,
    receivables,
    outstanding,
    errors
  };
}

export const load: PageServerLoad = async (event: RequestEvent) => {
  return loadDeskData(event);
};

async function createBooking(event: RequestEvent) {
  const formData = await event.request.formData();
  const sessionKey = text(formData, 'sessionKey');
  const seatKey = text(formData, 'seatKey');
  const startAt = text(formData, 'startAt');
  const endAt = text(formData, 'endAt');
  const capacity = numberOrNull(formData, 'capacity');
  const partySize = numberOrNull(formData, 'partySize');
  const invoiceId = text(formData, 'invoiceId');
  const priceBookId = text(formData, 'priceBookId');
  const priceBookItemId = text(formData, 'priceBookItemId');
  const notes = text(formData, 'notes');

  const fields: Record<string, string> = {};
  if (!sessionKey) fields.sessionKey = 'Required';
  if (!seatKey) fields.seatKey = 'Required';
  if (!startAt) fields.startAt = 'Required';
  if (!endAt) fields.endAt = 'Required';
  if (capacity === null || capacity <= 0) fields.capacity = 'Invalid';

  if (Object.keys(fields).length > 0) {
    return actionFail('createBooking', 'Please fix highlighted fields.', fields);
  }

  try {
    const result = await postApiJson<{ booking: { id: string; remainingCapacity: number } }>(event, '/bookings', {
      sessionKey,
      seatKey,
      startAt,
      endAt,
      capacity,
      partySize: partySize && partySize > 0 ? partySize : 1,
      invoiceId: invoiceId || undefined,
      priceBookId: priceBookId || undefined,
      priceBookItemId: priceBookItemId || undefined,
      notes: notes || undefined
    });

    return {
      action: 'createBooking',
      success: true,
      booking: result.booking
    };
  } catch (error) {
    return actionFail('createBooking', (error as Error).message);
  }
}

async function adjustBooking(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = text(formData, 'bookingId');
  const newSessionKey = text(formData, 'newSessionKey');
  const newSeatKey = text(formData, 'newSeatKey');
  const newStartAt = text(formData, 'newStartAt');
  const newEndAt = text(formData, 'newEndAt');
  const capacity = numberOrNull(formData, 'capacity');

  const fields: Record<string, string> = {};
  if (!bookingId) fields.bookingId = 'Required';
  if (!newSessionKey) fields.newSessionKey = 'Required';
  if (!newSeatKey) fields.newSeatKey = 'Required';
  if (!newStartAt) fields.newStartAt = 'Required';
  if (!newEndAt) fields.newEndAt = 'Required';
  if (capacity === null || capacity <= 0) fields.capacity = 'Invalid';

  if (Object.keys(fields).length > 0) {
    return actionFail('adjustBooking', 'Please fix highlighted fields.', fields);
  }

  try {
    const result = await postApiJson<{
      booking: { id: string; sessionKey: string; seatKey: string; startAt: string; endAt: string };
    }>(event, `/bookings/${encodeURIComponent(bookingId)}/reschedule`, {
      newSessionKey,
      newSeatKey,
      newStartAt,
      newEndAt,
      capacity
    });

    return {
      action: 'adjustBooking',
      success: true,
      adjusted: result
    };
  } catch (error) {
    return actionFail('adjustBooking', (error as Error).message);
  }
}

async function promoteWaitlist(event: RequestEvent) {
  const formData = await event.request.formData();
  const sessionKey = text(formData, 'sessionKey');
  const seatKey = text(formData, 'seatKey');
  const startAt = text(formData, 'startAt');
  const endAt = text(formData, 'endAt');
  const capacity = numberOrNull(formData, 'capacity');

  if (!sessionKey || !seatKey || !startAt || !endAt || capacity === null || capacity <= 0) {
    return actionFail('promoteWaitlist', 'Session key, seat key, schedule window and capacity are required.');
  }

  try {
    const result = await postApiJson<{
      promoted: boolean;
      reason?: string;
      booking?: { id: string; userId: string };
      waitlistEntryId?: string;
    }>(event, '/bookings/promote-next', {
      sessionKey,
      seatKey,
      startAt,
      endAt,
      capacity
    });

    return {
      action: 'promoteWaitlist',
      success: true,
      promotion: result
    };
  } catch (error) {
    return actionFail('promoteWaitlist', (error as Error).message);
  }
}

async function recordPayment(event: RequestEvent) {
  const formData = await event.request.formData();
  const invoiceId = text(formData, 'invoiceId');
  const method = text(formData, 'method');
  const amount = numberOrNull(formData, 'amount');
  const referenceNumber = text(formData, 'referenceNumber');
  const checkNumber = text(formData, 'checkNumber');
  const cardLast4 = text(formData, 'cardLast4');
  const cardBrand = text(formData, 'cardBrand');
  const cardAuthCode = text(formData, 'cardAuthCode');
  const notes = text(formData, 'notes');

  const methods = new Set(['CASH', 'CHECK', 'MANUAL_CARD']);
  if (!invoiceId || !methods.has(method) || amount === null || amount <= 0) {
    return actionFail('recordPayment', 'Invoice, valid payment method, and positive amount are required.', {
      invoiceId: !invoiceId ? 'Required' : '',
      method: !methods.has(method) ? 'Invalid' : '',
      amount: amount === null || amount <= 0 ? 'Invalid' : ''
    });
  }

  try {
    const result = await postApiJson<{
      invoiceId: string;
      payment: { id: string; method: string; amount: number };
      outstanding: { outstandingAmount: number };
    }>(event, '/billing/payments/manual', {
      invoiceId,
      method,
      amount,
      referenceNumber: referenceNumber || undefined,
      checkNumber: checkNumber || undefined,
      cardLast4: cardLast4 || undefined,
      cardBrand: cardBrand || undefined,
      cardAuthCode: cardAuthCode || undefined,
      notes: notes || undefined
    });

    return {
      action: 'recordPayment',
      success: true,
      payment: result
    };
  } catch (error) {
    return actionFail('recordPayment', (error as Error).message);
  }
}

async function previewCancellation(event: RequestEvent) {
  const formData = await event.request.formData();
  const bookingId = text(formData, 'bookingId');
  const baseAmount = numberOrNull(formData, 'baseAmount');

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
  const bookingId = text(formData, 'bookingId');
  const capacity = numberOrNull(formData, 'capacity');
  const baseAmount = numberOrNull(formData, 'baseAmount');

  if (!bookingId || capacity === null || capacity <= 0) {
    return actionFail('confirmCancellation', 'Booking ID and capacity are required.', {
      bookingId: !bookingId ? 'Required' : '',
      capacity: capacity === null || capacity <= 0 ? 'Invalid' : ''
    });
  }

  try {
    const result = await postApiJson<{
      canceledBookingId: string;
      feePreview: { policyBand: string; feePercent: number; feeAmount: number };
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
  createBooking,
  adjustBooking,
  promoteWaitlist,
  recordPayment,
  previewCancellation,
  confirmCancellation
};
