import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

import {
  categoryMeta,
  memberOfferings,
  type BookableOffering,
  type MembershipOffering,
  type OfferingCategory,
  type WorkspaceOffering
} from '$lib/member/offerings';
import { createUpcomingWindow, fetchApiJson } from '$lib/server/api';

type MembershipPriceResponse = {
  asOf: string;
  membershipPlan: {
    id: string;
    code: string;
    name: string;
    durationDays: number;
    includedCredits: number;
  };
  priceItem: {
    unitAmount: number;
    taxAmount: number;
  };
  priceBook: {
    currency: string;
  };
};

type CreditPackPriceResponse = {
  asOf: string;
  creditPack: {
    id: string;
    code: string;
    name: string;
    creditsAmount: number;
    expiresInDays: number | null;
  };
  priceItem: {
    unitAmount: number;
    taxAmount: number;
  };
  priceBook: {
    currency: string;
  };
};

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

export type OfferingLiveData = {
  price: {
    amount: number;
    taxAmount: number;
    currency: string;
    sourceLabel: string;
  } | null;
  availability: {
    startAt: string;
    endAt: string;
    opensAt: string;
    remainingCapacity: number;
    capacity: number;
    isBookableNow: boolean;
  } | null;
  errors: string[];
};

export type WorkspaceOfferingView = WorkspaceOffering & {
  live: OfferingLiveData;
};

export type WorkspaceCategoryView = {
  category: OfferingCategory;
  title: string;
  description: string;
  items: WorkspaceOfferingView[];
};

function readEnv(key: string): string | null {
  const value = (env as Record<string, string | undefined>)[key];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveMembershipLive(event: RequestEvent, offering: MembershipOffering): Promise<OfferingLiveData> {
  const membershipPlanId = readEnv(offering.membershipPlanIdEnv);
  if (!membershipPlanId) {
    return {
      price: null,
      availability: null,
      errors: [`Missing ${offering.membershipPlanIdEnv} for live pricing.`]
    };
  }

  try {
    const response = await fetchApiJson<MembershipPriceResponse>(
      event,
      `/billing/membership-plans/${membershipPlanId}/price`
    );

    return {
      price: {
        amount: response.priceItem.unitAmount,
        taxAmount: response.priceItem.taxAmount,
        currency: response.priceBook.currency,
        sourceLabel: response.membershipPlan.name
      },
      availability: null,
      errors: []
    };
  } catch (error) {
    return {
      price: null,
      availability: null,
      errors: [`Price unavailable: ${(error as Error).message}`]
    };
  }
}

async function resolveLinkedPackPrice(event: RequestEvent, creditPackIdEnv: string | undefined): Promise<{
  amount: number;
  taxAmount: number;
  currency: string;
  sourceLabel: string;
} | null> {
  if (!creditPackIdEnv) {
    return null;
  }

  const creditPackId = readEnv(creditPackIdEnv);
  if (!creditPackId) {
    return null;
  }

  try {
    const response = await fetchApiJson<CreditPackPriceResponse>(event, `/billing/credit-packs/${creditPackId}/price`);
    return {
      amount: response.priceItem.unitAmount,
      taxAmount: response.priceItem.taxAmount,
      currency: response.priceBook.currency,
      sourceLabel: response.creditPack.name
    };
  } catch {
    return null;
  }
}

async function resolveBookableLive(event: RequestEvent, offering: BookableOffering): Promise<OfferingLiveData> {
  const { startAt, endAt } = createUpcomingWindow(offering.availabilityLeadHours, offering.durationMinutes);

  try {
    const availability = await fetchApiJson<AvailabilityResponse>(
      event,
      `/bookings/availability?sessionKey=${encodeURIComponent(offering.sessionKey)}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}&capacity=${offering.capacity}`
    );

    const linkedPrice = await resolveLinkedPackPrice(event, offering.creditPackIdEnv);

    return {
      price: linkedPrice,
      availability: {
        startAt: availability.startAt,
        endAt: availability.endAt,
        opensAt: availability.opensAt,
        remainingCapacity: availability.remainingCapacity,
        capacity: availability.capacity,
        isBookableNow: availability.isBookableNow
      },
      errors: linkedPrice ? [] : ['No linked live price configured for this session offering.']
    };
  } catch (error) {
    return {
      price: null,
      availability: null,
      errors: [`Availability unavailable: ${(error as Error).message}`]
    };
  }
}

export async function resolveOfferingLiveData(event: RequestEvent, offering: WorkspaceOffering): Promise<OfferingLiveData> {
  if (offering.category === 'memberships') {
    return resolveMembershipLive(event, offering);
  }

  return resolveBookableLive(event, offering);
}

export async function loadMemberWorkspace(event: RequestEvent): Promise<WorkspaceCategoryView[]> {
  const resolved = await Promise.all(
    memberOfferings.map(async (offering) => {
      const live = await resolveOfferingLiveData(event, offering);
      return {
        ...offering,
        live
      } satisfies WorkspaceOfferingView;
    })
  );

  const grouped = Object.keys(categoryMeta).map((category) => {
    const typed = category as OfferingCategory;
    return {
      category: typed,
      title: categoryMeta[typed].title,
      description: categoryMeta[typed].description,
      items: resolved.filter((item) => item.category === typed)
    } satisfies WorkspaceCategoryView;
  });

  return grouped;
}
