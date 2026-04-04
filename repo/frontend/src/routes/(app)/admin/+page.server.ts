import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { fetchApiJson, postApiJson, putApiJson } from '$lib/server/api';

type EffectivePriceBook = {
  id: string;
  code: string;
  version: number;
  name: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
};

type MembershipPrice = {
  membershipPlan: { id: string; code: string; name: string };
  priceBook: { id: string; code: string; version: number; currency: string };
  priceItem: { id: string; unitAmount: number; taxAmount: number };
};

type CreditPackPrice = {
  creditPack: { id: string; code: string; name: string };
  priceBook: { id: string; code: string; version: number; currency: string };
  priceItem: { id: string; unitAmount: number; taxAmount: number };
};

type WorkflowAuditEvents = {
  filters: {
    runId: string | null;
    userId: string | null;
    stepId: string | null;
    eventTypes: string[] | null;
    from: string | null;
    to: string | null;
    limit: number;
  };
  events: Array<{
    id: string;
    workflowRunId: string;
    workflowRunStepId: string | null;
    actorUserId: string | null;
    eventType: string;
    eventData: unknown;
    createdAt: string;
  }>;
};

type WebhookLogs = {
  logs: Array<{
    id: string;
    webhookConfigId: string;
    eventKey: string;
    attemptNumber: number;
    deliveryStatus: string;
    responseStatusCode: number | null;
    errorMessage: string | null;
    requestedAt: string | null;
    respondedAt: string | null;
    createdAt: string;
  }>;
};

type WebhookAlerts = {
  alerts: Array<{
    id: string;
    webhookConfigId: string;
    eventKey: string;
    status: string;
    triggerType: string;
    failureCount: number;
    lastErrorMessage: string | null;
    acknowledgedByUserId: string | null;
    acknowledgedAt: string | null;
    createdAt: string;
  }>;
};

type NotificationPreference = {
  preference: {
    id: string;
    userId: string;
    globalMuted: boolean;
    mutedCategories: string[];
  } | null;
};

type ConsentRecord = {
  user: {
    id: string;
    username: string;
    displayName: string;
    consentGranted: boolean;
    consentGrantedAt: string | null;
    status: string;
  };
};

function q(url: URL, key: string): string {
  return url.searchParams.get(key)?.trim() ?? '';
}

function n(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function t(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function failAction(action: string, message: string, fields?: Record<string, string>) {
  return fail(400, {
    action,
    success: false,
    message,
    fields
  });
}

export const load = async (event: RequestEvent) => {
  const asOf = q(event.url, 'asOf');
  const currency = q(event.url, 'currency') || 'USD';
  const membershipPlanId = q(event.url, 'membershipPlanId');
  const creditPackId = q(event.url, 'creditPackId');

  const auditRunId = q(event.url, 'auditRunId');
  const auditUserId = q(event.url, 'auditUserId');
  const auditTypes = q(event.url, 'auditTypes');
  const auditFrom = q(event.url, 'auditFrom');
  const auditTo = q(event.url, 'auditTo');
  const auditLimit = q(event.url, 'auditLimit') || '50';

  const webhookEventKey = q(event.url, 'webhookEventKey');
  const webhookStatus = q(event.url, 'webhookStatus');
  const webhookLimit = q(event.url, 'webhookLimit') || '50';

  const alertsStatus = q(event.url, 'alertsStatus');
  const alertsLimit = q(event.url, 'alertsLimit') || '50';

  const privacyUserId = q(event.url, 'privacyUserId');
  const consentUserId = q(event.url, 'consentUserId');

  const errors: string[] = [];

  const effectivePriceBook = await fetchApiJson<EffectivePriceBook>(
    event,
    `/billing/price-books/effective?currency=${encodeURIComponent(currency)}${asOf ? `&asOf=${encodeURIComponent(asOf)}` : ''}`
  ).catch((error) => {
    errors.push(`Price book: ${(error as Error).message}`);
    return null;
  });

  const membershipPrice = membershipPlanId
    ? await fetchApiJson<MembershipPrice>(
        event,
        `/billing/membership-plans/${encodeURIComponent(membershipPlanId)}/price?currency=${encodeURIComponent(currency)}${asOf ? `&asOf=${encodeURIComponent(asOf)}` : ''}`
      ).catch((error) => {
        errors.push(`Membership price: ${(error as Error).message}`);
        return null;
      })
    : null;

  const creditPackPrice = creditPackId
    ? await fetchApiJson<CreditPackPrice>(
        event,
        `/billing/credit-packs/${encodeURIComponent(creditPackId)}/price?currency=${encodeURIComponent(currency)}${asOf ? `&asOf=${encodeURIComponent(asOf)}` : ''}`
      ).catch((error) => {
        errors.push(`Credit pack price: ${(error as Error).message}`);
        return null;
      })
    : null;

  const audit = await fetchApiJson<WorkflowAuditEvents>(
    event,
    `/workflows/events?${[
      auditRunId ? `runId=${encodeURIComponent(auditRunId)}` : '',
      auditUserId ? `userId=${encodeURIComponent(auditUserId)}` : '',
      auditTypes ? `types=${encodeURIComponent(auditTypes)}` : '',
      auditFrom ? `from=${encodeURIComponent(auditFrom)}` : '',
      auditTo ? `to=${encodeURIComponent(auditTo)}` : '',
      `limit=${encodeURIComponent(auditLimit)}`
    ]
      .filter(Boolean)
      .join('&')}`
  ).catch((error) => {
    errors.push(`Audit events: ${(error as Error).message}`);
    return null;
  });

  const webhookLogs = await fetchApiJson<WebhookLogs>(
    event,
    `/webhooks/logs?${[
      webhookEventKey ? `eventKey=${encodeURIComponent(webhookEventKey)}` : '',
      webhookStatus ? `deliveryStatus=${encodeURIComponent(webhookStatus)}` : '',
      `limit=${encodeURIComponent(webhookLimit)}`
    ]
      .filter(Boolean)
      .join('&')}`
  ).catch((error) => {
    errors.push(`Webhook logs: ${(error as Error).message}`);
    return null;
  });

  const webhookAlerts = await fetchApiJson<WebhookAlerts>(
    event,
    `/webhooks/failure-alerts?${[
      alertsStatus ? `status=${encodeURIComponent(alertsStatus)}` : '',
      `limit=${encodeURIComponent(alertsLimit)}`
    ]
      .filter(Boolean)
      .join('&')}`
  ).catch((error) => {
    errors.push(`Webhook alerts: ${(error as Error).message}`);
    return null;
  });

  const securityHealth = await fetchApiJson<{ status: string }>(event, '/auth/admin/health').catch((error) => {
    errors.push(`Security health: ${(error as Error).message}`);
    return null;
  });

  const privacyPreference = privacyUserId
    ? await fetchApiJson<NotificationPreference>(
        event,
        `/notifications/preferences?userId=${encodeURIComponent(privacyUserId)}`
      ).catch((error) => {
        errors.push(`Privacy preference: ${(error as Error).message}`);
        return null;
      })
    : null;

  const consentRecord = consentUserId
    ? await fetchApiJson<ConsentRecord>(event, `/auth/admin/users/${encodeURIComponent(consentUserId)}/consent`).catch((error) => {
        errors.push(`Consent record: ${(error as Error).message}`);
        return null;
      })
    : null;

  return {
    filters: {
      asOf,
      currency,
      membershipPlanId,
      creditPackId,
      auditRunId,
      auditUserId,
      auditTypes,
      auditFrom,
      auditTo,
      auditLimit,
      webhookEventKey,
      webhookStatus,
      webhookLimit,
      alertsStatus,
      alertsLimit,
      privacyUserId,
      consentUserId
    },
    effectivePriceBook,
    membershipPrice,
    creditPackPrice,
    audit,
    webhookLogs,
    webhookAlerts,
    securityHealth,
    privacyPreference,
    consentRecord,
    errors
  };
};

async function issueDiscountInvoice(event: RequestEvent) {
  const formData = await event.request.formData();

  const customerUserId = t(formData, 'customerUserId');
  const lineType = t(formData, 'lineType');
  const lineRefId = t(formData, 'lineRefId');
  const quantity = n(formData, 'quantity') ?? 1;
  const discountPercent = n(formData, 'discountPercent') ?? 0;
  const discountReason = t(formData, 'discountReason');
  const dueAt = t(formData, 'dueAt');
  const currency = t(formData, 'currency') || 'USD';

  const fields: Record<string, string> = {};
  if (!lineType) fields.lineType = 'Required';
  if (!lineRefId) fields.lineRefId = 'Required';
  if (quantity <= 0) fields.quantity = 'Invalid';
  if (discountPercent < 0) fields.discountPercent = 'Invalid';
  if (discountPercent > 0 && !discountReason) fields.discountReason = 'Required for discount';

  if (Object.keys(fields).length > 0) {
    return failAction('issueDiscountInvoice', 'Please fix highlighted fields.', fields);
  }

  const line =
    lineType === 'MEMBERSHIP_PLAN'
      ? { type: 'MEMBERSHIP_PLAN' as const, membershipPlanId: lineRefId, quantity }
      : { type: 'CREDIT_PACK' as const, creditPackId: lineRefId, quantity };

  try {
    const issued = await postApiJson<{ invoiceId: string; invoiceNumber: string }>(event, '/billing/invoices/issue', {
      customerUserId: customerUserId || undefined,
      currency,
      dueAt: dueAt || undefined,
      discountPercent,
      discountReason: discountReason || undefined,
      lines: [line]
    });

    const invoice = await fetchApiJson(event, `/billing/invoices/${encodeURIComponent(issued.invoiceId)}`);

    return {
      action: 'issueDiscountInvoice',
      success: true,
      issued,
      invoice
    };
  } catch (error) {
    return failAction('issueDiscountInvoice', (error as Error).message);
  }
}

async function acknowledgeWebhookAlertAction(event: RequestEvent) {
  const formData = await event.request.formData();
  const alertId = t(formData, 'alertId');
  if (!alertId) {
    return failAction('ackWebhookAlert', 'Alert ID is required.', { alertId: 'Required' });
  }

  try {
    const alert = await postApiJson(event, `/webhooks/failure-alerts/${encodeURIComponent(alertId)}/ack`, {});
    return {
      action: 'ackWebhookAlert',
      success: true,
      alert
    };
  } catch (error) {
    return failAction('ackWebhookAlert', (error as Error).message);
  }
}

async function dispatchWebhooksNow(event: RequestEvent) {
  const formData = await event.request.formData();
  const limit = n(formData, 'limit') ?? 50;

  try {
    const result = await postApiJson(event, '/webhooks/dispatch-due', { limit });
    return {
      action: 'dispatchWebhooksNow',
      success: true,
      result
    };
  } catch (error) {
    return failAction('dispatchWebhooksNow', (error as Error).message);
  }
}

async function updatePrivacyControls(event: RequestEvent) {
  const formData = await event.request.formData();
  const userId = t(formData, 'userId');
  const globalMutedRaw = t(formData, 'globalMuted');
  const mutedCategoriesRaw = t(formData, 'mutedCategories');

  if (!userId) {
    return failAction('updatePrivacyControls', 'User ID is required.', { userId: 'Required' });
  }

  const globalMuted = globalMutedRaw === 'true';
  const mutedCategories = mutedCategoriesRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const result = await putApiJson(event, '/notifications/preferences', {
      userId,
      globalMuted,
      mutedCategories
    });

    return {
      action: 'updatePrivacyControls',
      success: true,
      preference: result
    };
  } catch (error) {
    return failAction('updatePrivacyControls', (error as Error).message);
  }
}

async function updateConsentControls(event: RequestEvent) {
  const formData = await event.request.formData();
  const userId = t(formData, 'userId');
  const consentGranted = t(formData, 'consentGranted') === 'true';

  if (!userId) {
    return failAction('updateConsentControls', 'User ID is required.', { userId: 'Required' });
  }

  try {
    const result = await putApiJson(event, `/auth/admin/users/${encodeURIComponent(userId)}/consent`, {
      consentGranted
    });

    return {
      action: 'updateConsentControls',
      success: true,
      consent: result
    };
  } catch (error) {
    return failAction('updateConsentControls', (error as Error).message);
  }
}

export const actions = {
  issueDiscountInvoice,
  acknowledgeWebhookAlert: acknowledgeWebhookAlertAction,
  dispatchWebhooksNow,
  updatePrivacyControls,
  updateConsentControls
};
