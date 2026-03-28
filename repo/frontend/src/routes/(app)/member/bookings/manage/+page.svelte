<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let bookingId = data.bookingId || '';
  let baseAmount = '';
  let capacity = '12';
  let newSessionKey = '';
  let newSeatKey = '';
  let newStartAt = '';
  let newEndAt = '';

  function money(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  }

  $: preview = form?.action === 'previewCancellation' && form?.success ? form.preview : null;
  $: cancellation = form?.action === 'confirmCancellation' && form?.success ? form.cancellation : null;
  $: reschedule = form?.action === 'reschedule' && form?.success ? form.reschedule : null;

  $: if (form?.action && !form?.success && form?.message) {
    toast.error('Action failed', { description: form.message });
  }

  $: if (cancellation) {
    toast.success('Booking canceled', {
      description: `Canceled booking ${cancellation.canceledBookingId}`
    });
  }

  $: if (reschedule?.booking) {
    toast.success('Booking rescheduled', {
      description: `Updated booking ${reschedule.booking.id}`
    });
  }

  onMount(() => {
    const timer = setInterval(() => {
      if (bookingId) {
        invalidateAll();
      }
    }, 30000);

    return () => clearInterval(timer);
  });
</script>

<div class="space-y-s6">
  <div class="flex items-center justify-between">
    <a href="/member" class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      ← Back to member workspace
    </a>
    <a href="/member/bookings/new" class="text-sm text-muted-foreground transition-colors hover:text-foreground">Open new booking flow</a>
  </div>

  <Card className="p-s6 md:p-s8">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Change of plans</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Manage an existing booking</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">
      Reschedule or cancel using real booking APIs. Provide an existing booking ID from your account.
    </p>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s6">
      <h2 class="text-base font-semibold">Cancellation</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Preview policy and fees first, then confirm cancellation.</p>

      <form method="POST" action="?/previewCancellation" class="mt-s4 space-y-s3">
        <div class="space-y-s2">
          <Label for="cancel-booking-id">Booking ID</Label>
          <Input id="cancel-booking-id" name="bookingId" bind:value={bookingId} aria-invalid={form?.fields?.bookingId ? 'true' : 'false'} />
          {#if form?.fields?.bookingId}
            <p class="text-xs text-red-600 dark:text-red-400">{form.fields.bookingId}</p>
          {/if}
        </div>

        <div class="space-y-s2">
          <Label for="cancel-base-amount">Base amount (optional override)</Label>
          <Input id="cancel-base-amount" name="baseAmount" bind:value={baseAmount} placeholder="e.g. 79.00" />
        </div>

        <Button type="submit" size="sm" variant="secondary">Preview cancellation fee</Button>
      </form>

      {#if preview}
        <div class="mt-s4 rounded-md border bg-background/70 p-s3 text-sm">
          <p>Policy band: <span class="font-medium">{preview.preview.policyBand}</span></p>
          <p class="mt-1">Fee percent: <span class="font-medium">{preview.preview.feePercent}%</span></p>
          <p class="mt-1">Fee amount: <span class="font-medium">{money(preview.preview.feeAmount)}</span></p>
          <p class="mt-1 text-muted-foreground">Generated at {new Date(preview.preview.generatedAt).toLocaleString()}</p>
        </div>
      {/if}

      <form method="POST" action="?/confirmCancellation" class="mt-s4 space-y-s3">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="baseAmount" value={baseAmount} />

        <div class="space-y-s2">
          <Label for="cancel-capacity">Session capacity</Label>
          <Input
            id="cancel-capacity"
            name="capacity"
            bind:value={capacity}
            aria-invalid={form?.fields?.capacity ? 'true' : 'false'}
          />
          {#if form?.fields?.capacity}
            <p class="text-xs text-red-600 dark:text-red-400">{form.fields.capacity}</p>
          {/if}
        </div>

        <Button type="submit" disabled={!preview}>Confirm cancellation</Button>
      </form>

      {#if cancellation}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Cancellation confirmed for booking {cancellation.canceledBookingId}. Fee applied: {money(cancellation.feePreview.feeAmount)}.
        </div>
      {/if}
    </Card>

    <Card className="p-s6">
      <h2 class="text-base font-semibold">Reschedule</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Move booking to another slot using the reschedule endpoint.</p>

      <form method="POST" action="?/reschedule" class="mt-s4 space-y-s3">
        <div class="space-y-s2">
          <Label for="reschedule-booking-id">Booking ID</Label>
          <Input
            id="reschedule-booking-id"
            name="bookingId"
            bind:value={bookingId}
            aria-invalid={form?.fields?.bookingId ? 'true' : 'false'}
          />
          {#if form?.fields?.bookingId}
            <p class="text-xs text-red-600 dark:text-red-400">{form.fields.bookingId}</p>
          {/if}
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="new-session-key">New session key</Label>
            <Input id="new-session-key" name="newSessionKey" bind:value={newSessionKey} aria-invalid={form?.fields?.newSessionKey ? 'true' : 'false'} />
            {#if form?.fields?.newSessionKey}
              <p class="text-xs text-red-600 dark:text-red-400">{form.fields.newSessionKey}</p>
            {/if}
          </div>
          <div class="space-y-s2">
            <Label for="new-seat-key">New seat key</Label>
            <Input id="new-seat-key" name="newSeatKey" bind:value={newSeatKey} aria-invalid={form?.fields?.newSeatKey ? 'true' : 'false'} />
            {#if form?.fields?.newSeatKey}
              <p class="text-xs text-red-600 dark:text-red-400">{form.fields.newSeatKey}</p>
            {/if}
          </div>
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="new-start-at">New start time (ISO)</Label>
            <Input id="new-start-at" name="newStartAt" bind:value={newStartAt} placeholder="2026-04-01T18:00:00.000Z" aria-invalid={form?.fields?.newStartAt ? 'true' : 'false'} />
            {#if form?.fields?.newStartAt}
              <p class="text-xs text-red-600 dark:text-red-400">{form.fields.newStartAt}</p>
            {/if}
          </div>
          <div class="space-y-s2">
            <Label for="new-end-at">New end time (ISO)</Label>
            <Input id="new-end-at" name="newEndAt" bind:value={newEndAt} placeholder="2026-04-01T19:00:00.000Z" aria-invalid={form?.fields?.newEndAt ? 'true' : 'false'} />
            {#if form?.fields?.newEndAt}
              <p class="text-xs text-red-600 dark:text-red-400">{form.fields.newEndAt}</p>
            {/if}
          </div>
        </div>

        <div class="space-y-s2">
          <Label for="reschedule-capacity">Target capacity</Label>
          <Input id="reschedule-capacity" name="capacity" bind:value={capacity} aria-invalid={form?.fields?.capacity ? 'true' : 'false'} />
        </div>

        <Button type="submit">Confirm reschedule</Button>
      </form>

      {#if reschedule?.booking}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Booking {reschedule.booking.id} moved to {reschedule.booking.sessionKey} / {reschedule.booking.seatKey}.
        </div>
      {/if}
    </Card>
  </div>
</div>
