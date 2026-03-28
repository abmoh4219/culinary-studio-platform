export type OfferingCategory = 'memberships' | 'group-classes' | 'coaching' | 'value-added';

type CommonOffering = {
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  ctaLabel: string;
};

export type MembershipOffering = CommonOffering & {
  category: 'memberships';
  membershipPlanIdEnv: string;
};

export type BookableOffering = CommonOffering & {
  category: 'group-classes' | 'coaching' | 'value-added';
  sessionKey: string;
  seatKey: string;
  capacity: number;
  durationMinutes: number;
  availabilityLeadHours: number;
  creditPackIdEnv?: string;
};

export type WorkspaceOffering = MembershipOffering | BookableOffering;

export const memberOfferings: WorkspaceOffering[] = [
  {
    category: 'memberships',
    slug: 'studio-monthly',
    title: 'Studio Monthly Membership',
    shortDescription: 'Recurring monthly plan for regular studio access.',
    longDescription:
      'Includes monthly studio access privileges with credits and preferred booking window where policy allows.',
    ctaLabel: 'View Membership',
    membershipPlanIdEnv: 'PUBLIC_MEMBERSHIP_MONTHLY_PLAN_ID'
  },
  {
    category: 'memberships',
    slug: 'studio-monthly-plus',
    title: 'Studio Monthly Plus',
    shortDescription: 'Higher monthly allowance for frequent participants.',
    longDescription:
      'Expanded monthly plan intended for members who attend classes and coaching sessions frequently.',
    ctaLabel: 'View Membership',
    membershipPlanIdEnv: 'PUBLIC_MEMBERSHIP_PLUS_PLAN_ID'
  },
  {
    category: 'group-classes',
    slug: 'group-class-knife-techniques',
    title: 'Single-Seat Group Class: Knife Techniques',
    shortDescription: 'Technique lab format with one seat per booking.',
    longDescription:
      'Structured group class focused on knife control, speed, and consistency under chef guidance.',
    ctaLabel: 'Book Seat',
    sessionKey: 'group.class.knife-techniques',
    seatKey: 'seat-main',
    capacity: 12,
    durationMinutes: 90,
    availabilityLeadHours: 36,
    creditPackIdEnv: 'PUBLIC_GROUP_CLASS_CREDIT_PACK_ID'
  },
  {
    category: 'coaching',
    slug: 'personal-coaching-performance',
    title: 'Personal Coaching Session',
    shortDescription: 'One-on-one coaching with focused skill targets.',
    longDescription:
      'Private session format tailored to member goals with direct instructor feedback and pacing.',
    ctaLabel: 'Book Coaching',
    sessionKey: 'coaching.personal.performance',
    seatKey: 'coach-room-a',
    capacity: 1,
    durationMinutes: 60,
    availabilityLeadHours: 48,
    creditPackIdEnv: 'PUBLIC_COACHING_CREDIT_PACK_ID'
  },
  {
    category: 'value-added',
    slug: 'value-added-sensory-lab',
    title: 'Value-Added Service: Sensory Lab',
    shortDescription: 'Short premium add-on session before or after class.',
    longDescription:
      'Add-on sensory calibration session designed to improve palate recognition and flavor mapping.',
    ctaLabel: 'Reserve Add-On',
    sessionKey: 'service.value-added.sensory-lab',
    seatKey: 'lab-station-a',
    capacity: 6,
    durationMinutes: 45,
    availabilityLeadHours: 30,
    creditPackIdEnv: 'PUBLIC_VALUE_ADD_CREDIT_PACK_ID'
  }
];

export const categoryMeta: Record<OfferingCategory, { title: string; description: string }> = {
  memberships: {
    title: 'Monthly Memberships',
    description: 'Recurring plans with live pricing from billing endpoints.'
  },
  'group-classes': {
    title: 'Single-Seat Group Classes',
    description: 'Session offerings with live seat availability snapshots.'
  },
  coaching: {
    title: 'Personal Coaching Sessions',
    description: 'Private coaching slots with live availability checks.'
  },
  'value-added': {
    title: 'Value-Added Services',
    description: 'Premium add-ons with availability and optional price links.'
  }
};

export function getOfferingBySlug(slug: string): WorkspaceOffering | undefined {
  return memberOfferings.find((item) => item.slug === slug);
}
