<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { TableShell } from '$lib/components/ui/table';

  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let asOf = data.filters.asOf || '';
  let currency = data.filters.currency || 'USD';
  let membershipPlanId = data.filters.membershipPlanId || '';
  let creditPackId = data.filters.creditPackId || '';

  let auditRunId = data.filters.auditRunId || '';
  let auditUserId = data.filters.auditUserId || '';
  let auditTypes = data.filters.auditTypes || '';
  let auditFrom = data.filters.auditFrom || '';
  let auditTo = data.filters.auditTo || '';
  let auditLimit = data.filters.auditLimit || '50';

  let webhookEventKey = data.filters.webhookEventKey || '';
  let webhookStatus = data.filters.webhookStatus || '';
  let webhookLimit = data.filters.webhookLimit || '50';

  let alertsStatus = data.filters.alertsStatus || '';
  let alertsLimit = data.filters.alertsLimit || '50';

  let privacyUserId = data.filters.privacyUserId || '';
  let consentUserId = data.filters.consentUserId || '';

  let invoiceCustomerUserId = '';
  let invoiceLineType = 'MEMBERSHIP_PLAN';
  let invoiceLineRefId = '';
  let invoiceQuantity = '1';
  let invoiceDiscountPercent = '0';
  let invoiceDiscountReason = '';
  let invoiceDueAt = '';

  let ackAlertId = '';
  let dispatchLimit = '50';

  let globalMuted = false;
  let mutedCategories = '';
  let consentGranted = 'false';

  $: issuedInvoice =
    form?.action === 'issueDiscountInvoice' && form?.success
      ? (form.issued as { invoiceNumber: string; invoiceId: string })
      : null;
  $: issuedInvoiceDetail =
    form?.action === 'issueDiscountInvoice' && form?.success
      ? (form.invoice as { discountOverrides?: Array<unknown> })
      : null;
  $: ackedAlert =
    form?.action === 'ackWebhookAlert' && form?.success ? (form.alert as { id: string } | null) : null;
  $: dispatchResult =
    form?.action === 'dispatchWebhooksNow' && form?.success
      ? (form.result as { attempted?: number } | null)
      : null;
  $: updatedPreference =
    form?.action === 'updatePrivacyControls' && form?.success
      ? (form.preference as { preference?: { userId?: string } } | null)
      : null;
  $: updatedConsent =
    form?.action === 'updateConsentControls' && form?.success
      ? (form.consent as { user?: { id?: string; consentGranted?: boolean } } | null)
      : null;

  $: if (form?.action && !form?.success && form?.message) {
    toast.error('Action failed', { description: form.message });
  }

  $: if (issuedInvoice) {
    toast.success('Invoice issued', { description: issuedInvoice.invoiceNumber });
  }

  $: if (ackedAlert?.id) {
    toast.success('Webhook alert acknowledged', { description: ackedAlert.id });
  }

  $: if (dispatchResult?.attempted !== undefined) {
    toast.success('Webhook dispatch executed', { description: `Attempted ${dispatchResult.attempted}` });
  }

  $: if (updatedPreference?.preference?.userId) {
    toast.success('Privacy controls updated', { description: updatedPreference.preference.userId });
  }

  $: if (updatedConsent?.user?.id) {
    toast.success('Consent record updated', {
      description: `${updatedConsent.user.id}: ${updatedConsent.user.consentGranted ? 'granted' : 'revoked'}`
    });
  }

  onMount(() => {
    if (data.errors.length > 0) {
      toast.warning('Some admin data failed to load', { description: data.errors[0] });
    }

    if (data.privacyPreference?.preference) {
      globalMuted = data.privacyPreference.preference.globalMuted;
      mutedCategories = data.privacyPreference.preference.mutedCategories.join(',');
    }

    if (data.consentRecord?.user) {
      consentGranted = data.consentRecord.user.consentGranted ? 'true' : 'false';
    }
  });
</script>

<div class="space-y-s8 pb-s12">
  <div class="flex flex-wrap items-center justify-between gap-s3">
    <a href="/" class="inline-flex items-center gap-s2 rounded-full border border-border/70 bg-card/60 px-s3 py-s2 text-sm text-muted-foreground surface-transition hover:bg-muted/60 hover:text-foreground">
      ← Back to shell
    </a>
    <p class="section-eyebrow">Administrator Workspace</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <p class="section-eyebrow">Admin Control Room</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Pricing, controls, and operational governance</h1>
    <p class="mt-s2 max-w-4xl text-sm text-muted-foreground md:text-base">
      Real API integrations for effective price-book resolution, discount overrides via invoicing, operational audit streams,
      webhook delivery governance, runtime security checks, and exposed privacy controls.
    </p>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1.1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Pricing rules and effective versions</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Resolve published effective price book at any datetime/currency and inspect live plan/pack prices.</p>

      <form method="GET" class="mt-s4 grid gap-s3 rounded-lg border border-border/70 bg-background/30 p-s4 md:grid-cols-2">
        <div class="space-y-s2">
          <Label for="price-as-of">As of (ISO)</Label>
          <Input id="price-as-of" name="asOf" bind:value={asOf} placeholder="2026-04-05T00:00:00.000Z" />
        </div>
        <div class="space-y-s2">
          <Label for="price-currency">Currency</Label>
          <Input id="price-currency" name="currency" bind:value={currency} placeholder="USD" />
        </div>
        <div class="space-y-s2">
          <Label for="membership-plan-id">Membership plan ID</Label>
          <Input id="membership-plan-id" name="membershipPlanId" bind:value={membershipPlanId} />
        </div>
        <div class="space-y-s2">
          <Label for="credit-pack-id">Credit pack ID</Label>
          <Input id="credit-pack-id" name="creditPackId" bind:value={creditPackId} />
        </div>
        <div class="md:col-span-2 pt-s1">
          <Button type="submit" className="h-12">Resolve effective pricing</Button>
        </div>
      </form>

      {#if data.effectivePriceBook}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>
            Effective book: <span class="font-medium">{data.effectivePriceBook.code}</span>
            v{data.effectivePriceBook.version}
          </p>
          <p class="mt-1 text-muted-foreground">
            Valid from {new Date(data.effectivePriceBook.validFrom).toLocaleString()} to
            {data.effectivePriceBook.validTo ? ` ${new Date(data.effectivePriceBook.validTo).toLocaleString()}` : ' open-ended'}
          </p>
          <p class="mt-2 text-xs text-muted-foreground">Pricing contract exposes only published/effective books; draft mutation endpoints are not exposed in this API.</p>
        </div>
      {/if}

      {#if data.membershipPrice}
        <div class="mt-s3 glass-panel p-s3 text-sm">
          <p class="font-medium">Membership price: {data.membershipPrice.membershipPlan.name}</p>
          <p class="mt-1">Unit {data.membershipPrice.priceItem.unitAmount.toFixed(2)} {data.membershipPrice.priceBook.currency}</p>
          <p class="text-muted-foreground">Tax {data.membershipPrice.priceItem.taxAmount.toFixed(2)}</p>
        </div>
      {/if}

      {#if data.creditPackPrice}
        <div class="mt-s3 glass-panel p-s3 text-sm">
          <p class="font-medium">Credit pack price: {data.creditPackPrice.creditPack.name}</p>
          <p class="mt-1">Unit {data.creditPackPrice.priceItem.unitAmount.toFixed(2)} {data.creditPackPrice.priceBook.currency}</p>
          <p class="text-muted-foreground">Tax {data.creditPackPrice.priceItem.taxAmount.toFixed(2)}</p>
        </div>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Discount overrides (invoice issue flow)</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Create invoice lines with discount percent and reason; backend enforces override policy and immutability.</p>

      <form method="POST" action="?/issueDiscountInvoice" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <div class="space-y-s2">
          <Label for="customer-user-id">Customer user ID (optional)</Label>
          <Input id="customer-user-id" name="customerUserId" bind:value={invoiceCustomerUserId} />
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="line-type">Line type</Label>
            <select id="line-type" name="lineType" bind:value={invoiceLineType} class="field-select">
              <option value="MEMBERSHIP_PLAN">MEMBERSHIP_PLAN</option>
              <option value="CREDIT_PACK">CREDIT_PACK</option>
            </select>
          </div>
          <div class="space-y-s2">
            <Label for="line-ref-id">Line reference ID</Label>
            <Input id="line-ref-id" name="lineRefId" bind:value={invoiceLineRefId} />
          </div>
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="line-qty">Quantity</Label>
            <Input id="line-qty" name="quantity" bind:value={invoiceQuantity} />
          </div>
          <div class="space-y-s2">
            <Label for="line-currency">Currency</Label>
            <Input id="line-currency" name="currency" bind:value={currency} />
          </div>
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="discount-percent">Discount percent</Label>
            <Input id="discount-percent" name="discountPercent" bind:value={invoiceDiscountPercent} />
          </div>
          <div class="space-y-s2">
            <Label for="invoice-due-at">Due at (ISO optional)</Label>
            <Input id="invoice-due-at" name="dueAt" bind:value={invoiceDueAt} />
          </div>
        </div>

        <div class="space-y-s2">
          <Label for="discount-reason">Discount reason</Label>
          <Input id="discount-reason" name="discountReason" bind:value={invoiceDiscountReason} />
        </div>

        <Button type="submit">Issue discounted invoice</Button>
      </form>

      {#if issuedInvoice}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>Issued {issuedInvoice.invoiceNumber} ({issuedInvoice.invoiceId})</p>
          {#if issuedInvoiceDetail?.discountOverrides?.length}
            <p class="mt-1 text-muted-foreground">Overrides recorded: {issuedInvoiceDetail.discountOverrides.length}</p>
          {/if}
        </div>
      {/if}
    </Card>
  </div>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Audit logs (workflow event trail)</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Searchable event stream (run/user/type/date). This is the current audit stream exposed by API.</p>

      <form method="GET" class="mt-s4 grid gap-s3 rounded-lg border border-border/70 bg-background/30 p-s4 md:grid-cols-2">
        <div class="space-y-s2">
          <Label for="audit-run-id">Run ID</Label>
          <Input id="audit-run-id" name="auditRunId" bind:value={auditRunId} />
        </div>
        <div class="space-y-s2">
          <Label for="audit-user-id">User ID</Label>
          <Input id="audit-user-id" name="auditUserId" bind:value={auditUserId} />
        </div>
        <div class="space-y-s2">
          <Label for="audit-types">Types (CSV)</Label>
          <Input id="audit-types" name="auditTypes" bind:value={auditTypes} placeholder="STEP_COMPLETED,STEP_ROLLBACK" />
        </div>
        <div class="space-y-s2">
          <Label for="audit-limit">Limit</Label>
          <Input id="audit-limit" name="auditLimit" bind:value={auditLimit} />
        </div>
        <div class="space-y-s2">
          <Label for="audit-from">From (ISO)</Label>
          <Input id="audit-from" name="auditFrom" bind:value={auditFrom} />
        </div>
        <div class="space-y-s2">
          <Label for="audit-to">To (ISO)</Label>
          <Input id="audit-to" name="auditTo" bind:value={auditTo} />
        </div>
        <div class="md:col-span-2">
          <Button type="submit" variant="secondary">Search audit trail</Button>
        </div>
      </form>

      {#if data.audit?.events}
        <div class="mt-s4">
          <TableShell
            headers={["Timestamp", "Type", "Run", "Actor"]}
            rows={data.audit.events.slice(0, 10).map((event) => [new Date(event.createdAt).toLocaleString(), event.eventType, event.workflowRunId.slice(0, 8) + '…', event.actorUserId ? event.actorUserId.slice(0, 8) + '…' : '-'])}
          />
          {#if data.audit.events[0]}
            <div class="mt-s3 glass-panel p-s3 text-xs text-muted-foreground">
              Detail payload sample: {JSON.stringify(data.audit.events[0].eventData)}
            </div>
          {/if}
        </div>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Webhook logs and failures</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Delivery status stream, failure alerts, and acknowledgment actions.</p>

      <form method="GET" class="mt-s4 grid gap-s3 rounded-lg border border-border/70 bg-background/30 p-s4 md:grid-cols-2">
        <div class="space-y-s2">
          <Label for="webhook-event-key">Event key</Label>
          <Input id="webhook-event-key" name="webhookEventKey" bind:value={webhookEventKey} />
        </div>
        <div class="space-y-s2">
          <Label for="webhook-status">Delivery status</Label>
          <Input id="webhook-status" name="webhookStatus" bind:value={webhookStatus} placeholder="FAILED" />
        </div>
        <div class="space-y-s2">
          <Label for="webhook-limit">Log limit</Label>
          <Input id="webhook-limit" name="webhookLimit" bind:value={webhookLimit} />
        </div>
        <div class="space-y-s2">
          <Label for="alerts-status">Alert status</Label>
          <Input id="alerts-status" name="alertsStatus" bind:value={alertsStatus} placeholder="OPEN" />
        </div>
        <div class="space-y-s2">
          <Label for="alerts-limit">Alert limit</Label>
          <Input id="alerts-limit" name="alertsLimit" bind:value={alertsLimit} />
        </div>
        <div class="md:col-span-2">
          <Button type="submit" variant="secondary">Refresh webhook logs</Button>
        </div>
      </form>

      <form method="POST" action="?/dispatchWebhooksNow" class="mt-s3 inline-flex flex-wrap gap-s2 rounded-lg border border-border/70 bg-background/30 p-s3">
        <Input name="limit" bind:value={dispatchLimit} className="w-28" />
        <Button type="submit" variant="ghost">Dispatch due now</Button>
      </form>

      {#if data.webhookLogs?.logs}
        <div class="mt-s4">
          <TableShell
            headers={["Event", "Status", "Attempt", "Created"]}
            rows={data.webhookLogs.logs.slice(0, 8).map((log) => [log.eventKey, log.deliveryStatus, String(log.attemptNumber), new Date(log.createdAt).toLocaleString()])}
          />
        </div>
      {/if}

      <form method="POST" action="?/acknowledgeWebhookAlert" class="mt-s4 space-y-s2 rounded-md border border-border/70 bg-background/35 p-s3">
        <Label for="ack-alert-id">Acknowledge alert ID</Label>
        <div class="flex gap-s2">
          <Input id="ack-alert-id" name="alertId" bind:value={ackAlertId} />
          <Button type="submit">Ack</Button>
        </div>
      </form>

      {#if data.webhookAlerts?.alerts}
        <div class="mt-s3 glass-panel p-s3 text-sm">
          <p>Open/filtered alerts: {data.webhookAlerts.alerts.length}</p>
          {#if data.webhookAlerts.alerts[0]}
            <p class="mt-1 text-muted-foreground">Latest: {data.webhookAlerts.alerts[0].id} · {data.webhookAlerts.alerts[0].status}</p>
          {/if}
        </div>
      {/if}

      {#if ackedAlert}
        <div class="mt-s3 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Alert acknowledged: {ackedAlert.id}
        </div>
      {/if}
    </Card>
  </div>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Security settings (exposed controls)</h2>
      <p class="mt-s1 text-sm text-muted-foreground">
        Backend exposes runtime protections (lockout, rate-limit, signed requests, idempotency) as middleware. Config mutation endpoints are not exposed.
      </p>

      <div class="mt-s4 glass-panel p-s3 text-sm">
        <p>Admin health endpoint: <span class="font-medium">{data.securityHealth?.status ?? 'unavailable'}</span></p>
        <p class="mt-1 text-muted-foreground">All runtime controls are sourced from injected environment variables (no env files).</p>
      </div>
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Consent and privacy controls</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Manage notification privacy preferences and explicit user consent records.</p>

      <form method="GET" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <div class="space-y-s2">
          <Label for="privacy-user-id">User ID</Label>
          <Input id="privacy-user-id" name="privacyUserId" bind:value={privacyUserId} />
        </div>
        <Button type="submit" variant="secondary">Load privacy controls</Button>
      </form>

      {#if data.privacyPreference?.preference}
        <form method="POST" action="?/updatePrivacyControls" class="mt-s4 space-y-s3 rounded-md border border-border/70 bg-background/35 p-s3">
          <input type="hidden" name="userId" value={privacyUserId} />
          <div class="space-y-s2">
            <Label for="global-muted">Global muted</Label>
            <select id="global-muted" name="globalMuted" bind:value={globalMuted} class="field-select">
              <option value={false}>false</option>
              <option value={true}>true</option>
            </select>
          </div>
          <div class="space-y-s2">
            <Label for="muted-categories">Muted categories (CSV)</Label>
            <Input id="muted-categories" name="mutedCategories" bind:value={mutedCategories} placeholder="BOOKING_SUCCESS,CLASS_REMINDER" />
          </div>
          <Button type="submit">Update privacy controls</Button>
        </form>
      {/if}

      {#if updatedPreference}
        <div class="mt-s3 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Updated preference for user {updatedPreference.preference?.userId}
        </div>
      {/if}

      <form method="GET" class="mt-s5 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <div class="space-y-s2">
          <Label for="consent-user-id">Consent user ID</Label>
          <Input id="consent-user-id" name="consentUserId" bind:value={consentUserId} />
        </div>
        <Button type="submit" variant="secondary">Load consent record</Button>
      </form>

      {#if data.consentRecord?.user}
        <form method="POST" action="?/updateConsentControls" class="mt-s4 space-y-s3 rounded-md border border-border/70 bg-background/35 p-s3">
          <input type="hidden" name="userId" value={consentUserId} />
          <div class="space-y-s2">
            <Label for="consent-granted">Consent granted</Label>
            <select id="consent-granted" name="consentGranted" bind:value={consentGranted} class="field-select">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div class="text-xs text-muted-foreground">
            Current: {data.consentRecord.user.username} · {data.consentRecord.user.consentGranted ? 'granted' : 'revoked'}
          </div>
          <Button type="submit">Update consent record</Button>
        </form>
      {/if}

      {#if updatedConsent?.user?.id}
        <div class="mt-s3 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Updated consent for user {updatedConsent.user.id}.
        </div>
      {/if}
    </Card>
  </div>
</div>
