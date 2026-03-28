<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let sessionKey = data.params.sessionKey || '';
  let seatKey = '';
  let startAt = data.params.startAt || '';
  let endAt = data.params.endAt || '';
  let capacity = data.params.capacity || '12';
  let partySize = '1';
  let bookingId = '';
  let invoiceId = data.params.invoiceId || '';
  let userId = data.params.userId || '';

  let newSessionKey = '';
  let newSeatKey = '';
  let newStartAt = '';
  let newEndAt = '';

  let paymentMethod = 'CASH';
  let paymentAmount = '';
  let referenceNumber = '';
  let checkNumber = '';
  let cardLast4 = '';
  let cardBrand = '';
  let cardAuthCode = '';
  let paymentNotes = '';

  let cancelBaseAmount = '';
  let cancelCapacity = capacity || '12';

  $: cancelPreview = form?.action === 'previewCancellation' && form?.success ? form.preview : null;
  $: createResult = form?.action === 'createBooking' && form?.success ? form.booking : null;
  $: adjustResult = form?.action === 'adjustBooking' && form?.success ? form.adjusted : null;
  $: promotion = form?.action === 'promoteWaitlist' && form?.success ? form.promotion : null;
  $: payment = form?.action === 'recordPayment' && form?.success ? form.payment : null;
  $: cancellation = form?.action === 'confirmCancellation' && form?.success ? form.cancellation : null;

  $: if (form?.action && !form?.success && form?.message) {
    toast.error('Action failed', { description: form.message });
  }

  $: if (createResult) toast.success('Booking created', { description: `Booking ${createResult.id}` });
  $: if (adjustResult?.booking) toast.success('Booking adjusted', { description: `Booking ${adjustResult.booking.id}` });
  $: if (promotion?.promoted) toast.success('Waitlist promoted', { description: `Entry ${promotion.waitlistEntryId}` });
  $: if (payment?.payment) toast.success('Payment recorded', { description: `${payment.payment.method} ${payment.payment.amount}` });
  $: if (cancellation?.canceledBookingId) toast.success('Booking canceled', { description: cancellation.canceledBookingId });

  onMount(() => {
    if (data.errors.length > 0) {
      toast.warning('Some sections failed to load', { description: data.errors[0] });
    }
  });

  function pct(active: number, max: number): number {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((active / max) * 100));
  }
</script>

<div class="space-y-s8 pb-s12">
  <div class="flex flex-wrap items-center justify-between gap-s3">
    <a href="/" class="inline-flex items-center gap-s2 rounded-full border border-border/70 bg-card/60 px-s3 py-s2 text-sm text-muted-foreground surface-transition hover:bg-muted/60 hover:text-foreground">
      ← Back to shell
    </a>
    <p class="section-eyebrow">Front Desk Workspace</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <p class="section-eyebrow">Desk Operations</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Booking, waitlist, and payment desk</h1>
    <p class="mt-s2 max-w-3xl text-sm text-muted-foreground md:text-base">
      Real endpoint integration for booking operations, queue handling, manual tenders, outstanding balances, and cancellation policy enforcement.
    </p>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1.2fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Booking management</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Search availability, create booking, and adjust existing booking as allowed.</p>

      <form method="GET" class="mt-s4 grid gap-s3 rounded-lg border border-border/70 bg-background/30 p-s4 md:grid-cols-2">
        <div class="space-y-s2">
          <Label for="search-session-key">Session key</Label>
          <Input id="search-session-key" name="sessionKey" bind:value={sessionKey} />
        </div>
        <div class="space-y-s2">
          <Label for="search-capacity">Capacity</Label>
          <Input id="search-capacity" name="capacity" bind:value={capacity} />
        </div>
        <div class="space-y-s2">
          <Label for="search-start">Start (ISO)</Label>
          <Input id="search-start" name="startAt" bind:value={startAt} placeholder="2026-04-03T17:00:00.000Z" />
        </div>
        <div class="space-y-s2">
          <Label for="search-end">End (ISO)</Label>
          <Input id="search-end" name="endAt" bind:value={endAt} placeholder="2026-04-03T18:30:00.000Z" />
        </div>
        <div class="md:col-span-2 pt-s1">
          <Button type="submit" className="h-12">Search window</Button>
        </div>
      </form>

      {#if data.availability}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>Open: <span class="font-medium">{data.availability.isOpen ? 'Yes' : 'No'}</span></p>
          <p class="mt-1">Active bookings: <span class="font-medium">{data.availability.activeBookings}</span></p>
          <p class="mt-1">Remaining: <span class="font-medium">{data.availability.remainingCapacity}</span></p>
          <p class="mt-1">Fill: <span class="font-medium">{pct(data.availability.activeBookings, data.availability.capacity)}%</span></p>
        </div>
      {/if}

      <form method="POST" action="?/createBooking" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/35 p-s4">
        <p class="text-sm font-semibold">Create booking</p>
        <input type="hidden" name="sessionKey" value={sessionKey} />
        <input type="hidden" name="startAt" value={startAt} />
        <input type="hidden" name="endAt" value={endAt} />
        <input type="hidden" name="capacity" value={capacity} />

        <div class="space-y-s2">
          <Label for="create-seat-key">Seat key</Label>
          <Input id="create-seat-key" name="seatKey" bind:value={seatKey} aria-invalid={form?.fields?.seatKey ? 'true' : 'false'} />
        </div>
        <div class="space-y-s2">
          <Label for="create-party-size">Party size</Label>
          <Input id="create-party-size" name="partySize" bind:value={partySize} />
        </div>
        <div class="space-y-s2">
          <Label for="create-invoice-id">Invoice ID (optional)</Label>
          <Input id="create-invoice-id" name="invoiceId" bind:value={invoiceId} />
        </div>
        <Button type="submit">Create booking</Button>
      </form>

      <form method="POST" action="?/adjustBooking" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/35 p-s4">
        <p class="text-sm font-semibold">Adjust booking (reschedule)</p>
        <div class="space-y-s2">
          <Label for="adjust-booking-id">Booking ID</Label>
          <Input id="adjust-booking-id" name="bookingId" bind:value={bookingId} />
        </div>
        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="adjust-session-key">New session key</Label>
            <Input id="adjust-session-key" name="newSessionKey" bind:value={newSessionKey} />
          </div>
          <div class="space-y-s2">
            <Label for="adjust-seat-key">New seat key</Label>
            <Input id="adjust-seat-key" name="newSeatKey" bind:value={newSeatKey} />
          </div>
        </div>
        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="adjust-start">New start (ISO)</Label>
            <Input id="adjust-start" name="newStartAt" bind:value={newStartAt} />
          </div>
          <div class="space-y-s2">
            <Label for="adjust-end">New end (ISO)</Label>
            <Input id="adjust-end" name="newEndAt" bind:value={newEndAt} />
          </div>
        </div>
        <div class="space-y-s2">
          <Label for="adjust-capacity">Capacity</Label>
          <Input id="adjust-capacity" name="capacity" bind:value={capacity} />
        </div>
        <Button type="submit" variant="secondary">Apply adjustment</Button>
      </form>
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Waitlist handling</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Review queue and promote next when allowed.</p>

      {#if data.waitlist && data.waitlist.entries.length > 0}
        <div class="mt-s3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="py-2">Position</th>
                <th class="py-2">Status</th>
                <th class="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {#each data.waitlist.entries as entry}
                <tr class="border-t border-border/70">
                  <td class="py-2 font-medium">#{entry.queuePosition}</td>
                  <td class="py-2">{entry.status}</td>
                  <td class="py-2 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="mt-s3 text-sm text-muted-foreground">No queue entries for current session window.</p>
      {/if}

      <form method="POST" action="?/promoteWaitlist" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/35 p-s4">
        <input type="hidden" name="sessionKey" value={sessionKey} />
        <input type="hidden" name="startAt" value={startAt} />
        <input type="hidden" name="endAt" value={endAt} />
        <input type="hidden" name="capacity" value={capacity} />
        <div class="space-y-s2">
          <Label for="promote-seat-key">Seat key for promotion</Label>
          <Input id="promote-seat-key" name="seatKey" bind:value={seatKey} />
        </div>
        <Button type="submit">Promote next from queue</Button>
      </form>

      {#if promotion}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          {#if promotion.promoted}
            Promoted waitlist entry {promotion.waitlistEntryId}.
          {:else}
            Promotion not applied: {promotion.reason ?? 'No eligible entry'}.
          {/if}
        </div>
      {/if}
    </Card>
  </div>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Payments and balances</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Manual tender capture and outstanding balance lookup.</p>

      <form method="GET" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <div class="space-y-s2">
          <Label for="lookup-user-id">Account user ID</Label>
          <Input id="lookup-user-id" name="userId" bind:value={userId} />
        </div>
        <div class="space-y-s2">
          <Label for="lookup-invoice-id">Invoice ID</Label>
          <Input id="lookup-invoice-id" name="invoiceId" bind:value={invoiceId} />
        </div>
        <input type="hidden" name="sessionKey" value={sessionKey} />
        <input type="hidden" name="startAt" value={startAt} />
        <input type="hidden" name="endAt" value={endAt} />
        <input type="hidden" name="capacity" value={capacity} />
        <Button type="submit" variant="secondary">Load balances</Button>
      </form>

      {#if data.outstanding}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>Invoice: <span class="font-medium">{data.outstanding.invoiceNumber}</span></p>
          <p class="mt-1">Outstanding: <span class="font-medium">{data.outstanding.outstanding.outstandingAmount.toFixed(2)} {data.outstanding.currency}</span></p>
          <p class="mt-1 text-muted-foreground">Paid: {data.outstanding.outstanding.paidAmount.toFixed(2)}</p>
        </div>
      {/if}

      {#if data.receivables}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>Total outstanding: <span class="font-medium">{data.receivables.totalOutstanding.toFixed(2)}</span></p>
          <p class="mt-1 text-muted-foreground">Open invoices: {data.receivables.invoices.length}</p>
        </div>
      {/if}

      <form method="POST" action="?/recordPayment" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/35 p-s4">
        <div class="space-y-s2">
          <Label for="payment-invoice-id">Invoice ID</Label>
          <Input id="payment-invoice-id" name="invoiceId" bind:value={invoiceId} />
        </div>
        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="payment-method">Method</Label>
            <select id="payment-method" name="method" bind:value={paymentMethod} class="field-select">
              <option value="CASH">CASH</option>
              <option value="CHECK">CHECK</option>
              <option value="MANUAL_CARD">MANUAL_CARD</option>
            </select>
          </div>
          <div class="space-y-s2">
            <Label for="payment-amount">Amount</Label>
            <Input id="payment-amount" name="amount" bind:value={paymentAmount} />
          </div>
        </div>
        <div class="grid gap-s3 md:grid-cols-2">
          <Input name="referenceNumber" bind:value={referenceNumber} placeholder="Reference number" />
          <Input name="checkNumber" bind:value={checkNumber} placeholder="Check number" />
          <Input name="cardLast4" bind:value={cardLast4} placeholder="Card last4" />
          <Input name="cardBrand" bind:value={cardBrand} placeholder="Card brand" />
          <Input name="cardAuthCode" bind:value={cardAuthCode} placeholder="Auth code" />
          <Input name="notes" bind:value={paymentNotes} placeholder="Notes" />
        </div>
        <Button type="submit">Record payment</Button>
      </form>

      {#if payment?.payment}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Payment {payment.payment.id} recorded. Remaining outstanding: {payment.outstanding.outstandingAmount.toFixed(2)}.
        </div>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Cancellation handling</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Policy/fee preview first, then confirm cancellation.</p>

      <form method="POST" action="?/previewCancellation" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <div class="space-y-s2">
          <Label for="cancel-booking-id">Booking ID</Label>
          <Input id="cancel-booking-id" name="bookingId" bind:value={bookingId} />
        </div>
        <div class="space-y-s2">
          <Label for="cancel-base-amount">Base amount override (optional)</Label>
          <Input id="cancel-base-amount" name="baseAmount" bind:value={cancelBaseAmount} />
        </div>
        <Button type="submit" variant="secondary">Preview policy + fee</Button>
      </form>

      {#if cancelPreview}
        <div class="mt-s4 glass-panel p-s3 text-sm">
          <p>Policy: <span class="font-medium">{cancelPreview.preview.policyBand}</span></p>
          <p class="mt-1">Fee percent: <span class="font-medium">{cancelPreview.preview.feePercent}%</span></p>
          <p class="mt-1">Fee amount: <span class="font-medium">${cancelPreview.preview.feeAmount.toFixed(2)}</span></p>
        </div>
      {/if}

      <form method="POST" action="?/confirmCancellation" class="mt-s4 space-y-s3 rounded-lg border border-border/70 bg-background/30 p-s4">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="baseAmount" value={cancelBaseAmount} />

        <div class="space-y-s2">
          <Label for="cancel-capacity">Capacity</Label>
          <Input id="cancel-capacity" name="capacity" bind:value={cancelCapacity} />
        </div>
        <Button type="submit" disabled={!cancelPreview}>Confirm cancellation</Button>
      </form>

      {#if cancellation}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Canceled booking {cancellation.canceledBookingId}. Fee ${cancellation.feePreview.feeAmount.toFixed(2)}.
        </div>
      {/if}
    </Card>
  </div>

  <Card className="p-s4 text-xs text-muted-foreground">
    Note: API currently creates bookings for the authenticated user only; assigning bookings directly to arbitrary customers is not exposed by current backend routes.
  </Card>
</div>
