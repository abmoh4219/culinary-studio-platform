import { error, fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { getOfferingBySlug } from '$lib/member/offerings';
import { fetchAuthSession } from '$lib/server/auth';
import { fetchApiJson, postApiJson } from '$lib/server/api';
import { resolveOfferingLiveData } from '$lib/server/member-workspace';

import type { BookableOffering } from '$lib/member/offerings';
import type { PageServerLoad } from './$types';

type WaitlistResponse = {
  sessionKey: string;
  startAt: string;
  endAt: string;
  entries: Array<{
    id: string | null;
    userId: string | null;
    queuePosition: number;
    status: 'WAITING' | 'OFFERED' | 'CONVERTED';
    offeredAt: string | null;
    convertedAt: string | null;
    createdAt: string;
    bookingId: string | null;
  }>;
};

function assertBookable(offering: ReturnType<typeof getOfferingBySlug>): BookableOffering {
  if (!offering) {
    throw error(404, 'Offering not found');
  }

  if (offering.category === 'memberships') {
    throw error(400, 'This offering does not use direct booking.');
  }

  return offering;
}

async function loadWaitlist(
  event: Pick<RequestEvent, 'fetch' | 'request'>,
  offering: BookableOffering,
  startAt: string,
  endAt: string
) {
  const query = `/bookings/waitlist?sessionKey=${encodeURIComponent(offering.sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`;

  return fetchApiJson<WaitlistResponse>(event, query);
}

export const load: PageServerLoad = async (event) => {
  const slug = event.url.searchParams.get('offering');
  if (!slug) {
    throw error(400, 'Missing offering query parameter');
  }

  const offering = assertBookable(getOfferingBySlug(slug));

  const live = await resolveOfferingLiveData(event, offering);
  const session = await fetchAuthSession(event);

  let waitlist: WaitlistResponse | null = null;
  let myWaitlistEntry: WaitlistResponse['entries'][number] | null = null;

  if (live.availability) {
    waitlist = await loadWaitlist(event, offering, live.availability.startAt, live.availability.endAt).catch(() => null);
    myWaitlistEntry = waitlist?.entries.find((entry) => entry.userId === session?.user.sub) ?? null;
  }

  return {
    offering,
    live,
    waitlist,
    myWaitlistEntry
  };
};

export const actions = {
  previewFee: async (event: RequestEvent) => {
    const slug = event.url.searchParams.get('offering');
    if (!slug) {
      return fail(400, { action: 'previewFee', message: 'Missing offering query parameter.' });
    }

    const offering = assertBookable(getOfferingBySlug(slug));
    const live = await resolveOfferingLiveData(event, offering);

    if (!live.price) {
      return fail(400, {
        action: 'previewFee',
        message: 'Fee preview is unavailable for this offering.'
      });
    }

    const subtotal = live.price.amount;
    const tax = live.price.taxAmount;
    const total = subtotal + tax;

    return {
      action: 'previewFee',
      success: true,
      feePreview: {
        subtotal,
        tax,
        total,
        currency: live.price.currency,
        sourceLabel: live.price.sourceLabel
      }
    };
  },

  confirmBooking: async (event: RequestEvent) => {
    const slug = event.url.searchParams.get('offering');
    if (!slug) {
      return fail(400, { action: 'confirmBooking', message: 'Missing offering query parameter.' });
    }

    const offering = assertBookable(getOfferingBySlug(slug));
    const live = await resolveOfferingLiveData(event, offering);

    if (!live.availability) {
      return fail(400, {
        action: 'confirmBooking',
        message: 'Live availability is required before booking confirm.'
      });
    }

    try {
      const result = await postApiJson<{ booking: { id: string; remainingCapacity: number } }>(event, '/bookings', {
        sessionKey: offering.sessionKey,
        seatKey: offering.seatKey,
        startAt: live.availability.startAt,
        endAt: live.availability.endAt,
        capacity: live.availability.capacity,
        partySize: 1
      });

      return {
        action: 'confirmBooking',
        success: true,
        booking: result.booking
      };
    } catch (err) {
      return fail(409, {
        action: 'confirmBooking',
        message: (err as Error).message
      });
    }
  },

  joinWaitlist: async (event: RequestEvent) => {
    const slug = event.url.searchParams.get('offering');
    if (!slug) {
      return fail(400, { action: 'joinWaitlist', message: 'Missing offering query parameter.' });
    }

    const offering = assertBookable(getOfferingBySlug(slug));
    const live = await resolveOfferingLiveData(event, offering);

    if (!live.availability) {
      return fail(400, {
        action: 'joinWaitlist',
        message: 'Live availability is required before joining waitlist.'
      });
    }

    try {
      const join = await postApiJson<{
        alreadyQueued: boolean;
        waitlistEntry: WaitlistResponse['entries'][number];
      }>(event, '/bookings/waitlist', {
        sessionKey: offering.sessionKey,
        startAt: live.availability.startAt,
        endAt: live.availability.endAt,
        capacity: live.availability.capacity
      });

      const waitlist = await loadWaitlist(event, offering, live.availability.startAt, live.availability.endAt).catch(
        () => null
      );

      return {
        action: 'joinWaitlist',
        success: true,
        join,
        waitlist
      };
    } catch (err) {
      return fail(409, {
        action: 'joinWaitlist',
        message: (err as Error).message
      });
    }
  },

  refreshWaitlist: async (event: RequestEvent) => {
    const slug = event.url.searchParams.get('offering');
    if (!slug) {
      return fail(400, { action: 'refreshWaitlist', message: 'Missing offering query parameter.' });
    }

    const offering = assertBookable(getOfferingBySlug(slug));
    const live = await resolveOfferingLiveData(event, offering);

    if (!live.availability) {
      return fail(400, {
        action: 'refreshWaitlist',
        message: 'Live availability is required to refresh waitlist.'
      });
    }

    try {
      const waitlist = await loadWaitlist(event, offering, live.availability.startAt, live.availability.endAt);

      return {
        action: 'refreshWaitlist',
        success: true,
        waitlist
      };
    } catch (err) {
      return fail(409, {
        action: 'refreshWaitlist',
        message: (err as Error).message
      });
    }
  }
};
