<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { prefersReducedMotion } from '$lib/motion';
  import { Skeleton } from '$lib/components/ui/skeleton';

  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  const refreshMs = 20_000;

  function money(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }

  $: action = form?.action;
  $: feePreview = action === 'previewFee' && form?.success ? form.feePreview : null;
  $: bookingConfirmed = action === 'confirmBooking' && form?.success ? form.booking : null;
  $: waitlistFromAction =
    (action === 'joinWaitlist' || action === 'refreshWaitlist') && form?.success && form.waitlist ? form.waitlist : null;

  $: waitlist = waitlistFromAction ?? data.waitlist;
  $: myWaitlistEntry =
    waitlist?.entries?.find(
      (entry: { userId: string }) => entry.userId === data.myWaitlistEntry?.userId
    ) ?? data.myWaitlistEntry;

  $: if (action && form?.success) {
    if (action === 'confirmBooking') {
      const booking = form.booking;
      if (booking) {
        toast.success('Booking confirmed', {
          description: `Booking ID: ${booking.id}`
        });
      }
    }

    if (action === 'joinWaitlist') {
      const join = form.join;
      if (join) {
        toast.success('Waitlist updated', {
          description: join.alreadyQueued ? 'You were already in queue.' : 'You joined the waitlist.'
        });
      }
    }
  }

  $: if (action && !form?.success && form?.message) {
    toast.error('Action failed', {
      description: form.message
    });
  }

  onMount(() => {
    const interval = setInterval(() => {
      if (myWaitlistEntry && myWaitlistEntry.status !== 'CONVERTED') {
        invalidateAll();
      }
    }, refreshMs);

    return () => clearInterval(interval);
  });
</script>

<div class="space-y-s6">
  <a href={`/member/offerings/${data.offering.slug}`} class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
    ← Back to offering detail
  </a>

  <Card className="p-s6 md:p-s8">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Booking flow</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">{data.offering.title}</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">
      Review live availability and preview fees before confirming your booking.
    </p>

    {#if data.live.availability}
      <div class="mt-s6 rounded-lg border bg-background/70 p-s4">
        <p class="text-sm">
          Session window: <span class="font-medium">{new Date(data.live.availability.startAt).toLocaleString()}</span>
          {' '}-{' '}
          <span class="font-medium">{new Date(data.live.availability.endAt).toLocaleString()}</span>
        </p>
        <p class="mt-s2 text-sm text-muted-foreground">
          Remaining capacity: {data.live.availability.remainingCapacity}/{data.live.availability.capacity}
        </p>
        <p class="mt-s1 text-sm text-muted-foreground">
          Status: {data.live.availability.isBookableNow ? 'Open for booking' : 'Booking opens soon'}
        </p>
      </div>

      <div class="mt-s5 grid gap-s4 lg:grid-cols-2">
        <div class="rounded-lg border bg-background/70 p-s4">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Step 1: Fee preview</p>

          <form method="POST" action="?/previewFee" class="mt-s3">
            <Button type="submit" size="sm" variant="secondary">Preview fee</Button>
          </form>

          {#if feePreview}
            <div class="mt-s4 space-y-s1 text-sm">
              <p>
                Subtotal:
                <span class="font-medium">{money(feePreview.subtotal, feePreview.currency)}</span>
              </p>
              <p>
                Tax:
                <span class="font-medium">{money(feePreview.tax, feePreview.currency)}</span>
              </p>
              <p>
                Total:
                <span class="font-semibold">{money(feePreview.total, feePreview.currency)}</span>
              </p>
              <p class="text-xs text-muted-foreground">Source: {feePreview.sourceLabel}</p>
            </div>
          {:else if data.live.price}
            <div class="mt-s4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="mt-s2 h-3 w-32" />
            </div>
          {:else}
            <p class="mt-s3 text-sm text-muted-foreground">No linked pricing endpoint is configured for this offering.</p>
          {/if}
        </div>

        <div class="rounded-lg border bg-background/70 p-s4">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Step 2: Confirm booking</p>
          <form method="POST" action="?/confirmBooking" class="mt-s3">
            <Button type="submit" disabled={!feePreview && !!data.live.price}>
              Confirm booking
            </Button>
          </form>
          {#if !feePreview && data.live.price}
            <p class="mt-s2 text-xs text-muted-foreground">Preview fee first to enable confirm.</p>
          {/if}

          {#if bookingConfirmed}
            <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
              Booking confirmed: {bookingConfirmed.id}. Remaining capacity: {bookingConfirmed.remainingCapacity}.
            </div>
          {/if}
        </div>
      </div>

      <div class="mt-s6 rounded-lg border bg-background/70 p-s4">
        <div class="flex flex-wrap items-center justify-between gap-s3">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted-foreground">Waitlist</p>
            <p class="text-sm text-muted-foreground">Join and refresh to track queue position and promotion status.</p>
          </div>
          <div class="flex gap-s2">
            <form method="POST" action="?/refreshWaitlist">
              <Button size="sm" variant="secondary" type="submit">Refresh</Button>
            </form>
            <form method="POST" action="?/joinWaitlist">
              <Button size="sm" type="submit">Join waitlist</Button>
            </form>
          </div>
        </div>

        {#if myWaitlistEntry}
          <div class="mt-s4 rounded-md border px-s3 py-s2 text-sm">
            <p>
              Your position: <span class="font-semibold">#{myWaitlistEntry.queuePosition}</span>
            </p>
            <p class="mt-s1 text-muted-foreground">Status: {myWaitlistEntry.status}</p>
            {#if myWaitlistEntry.status === 'CONVERTED' && myWaitlistEntry.bookingId}
              <p class="mt-s1 text-emerald-600 dark:text-emerald-400">Promoted to booking {myWaitlistEntry.bookingId}</p>
            {/if}
          </div>
        {/if}

        {#if waitlist?.entries?.length}
          <div class="mt-s4 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="py-2">Position</th>
                  <th class="py-2">Status</th>
                  <th class="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {#each waitlist.entries as entry}
                  <tr class="border-t">
                    <td class="py-2 font-medium">#{entry.queuePosition}</td>
                    <td class="py-2">{entry.status}</td>
                    <td class="py-2 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="mt-s4 text-sm text-muted-foreground">No waitlist entries yet.</p>
        {/if}
      </div>
    {:else}
      <div class="mt-s6 rounded-lg border bg-background/70 p-s4 text-sm text-muted-foreground">
        Live availability could not be loaded for this booking handoff.
      </div>
    {/if}

    <div class="mt-s6">
      <a
        href="/member"
        class="inline-flex h-10 items-center justify-center rounded-md border px-s4 text-sm font-medium transition-colors hover:bg-muted"
      >
        Back to offerings list
      </a>
    </div>
  </Card>
</div>
