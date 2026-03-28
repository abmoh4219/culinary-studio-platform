<script lang="ts">
  import { Card } from '$lib/components/ui/card';

  import type { PageData } from './$types';

  export let data: PageData;

  function money(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }
</script>

<div class="space-y-s6">
  <a href="/member" class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
    ← Back to offerings
  </a>

  <Card className="p-s6 md:p-s8">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Offering detail</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">{data.offering.title}</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">{data.offering.longDescription}</p>

    <div class="mt-s6 grid gap-s4 md:grid-cols-2">
      <div class="rounded-lg border bg-background/70 p-s4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
        {#if data.live.price}
          <p class="mt-s2 text-xl font-semibold">{money(data.live.price.amount, data.live.price.currency)}</p>
          <p class="mt-s1 text-sm text-muted-foreground">
            Tax {money(data.live.price.taxAmount, data.live.price.currency)} via {data.live.price.sourceLabel}
          </p>
        {:else}
          <p class="mt-s2 text-sm text-muted-foreground">Live price is not available for this offering.</p>
        {/if}
      </div>

      <div class="rounded-lg border bg-background/70 p-s4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">Availability</p>
        {#if data.live.availability}
          <p class="mt-s2 text-xl font-semibold">
            {data.live.availability.remainingCapacity}/{data.live.availability.capacity}
          </p>
          <p class="mt-s1 text-sm text-muted-foreground">
            {data.live.availability.isBookableNow ? 'Open now' : 'Opens at'} {new Date(data.live.availability.opensAt).toLocaleString()}
          </p>
        {:else}
          <p class="mt-s2 text-sm text-muted-foreground">No live availability snapshot for this offering.</p>
        {/if}
      </div>
    </div>

    {#if data.live.errors.length > 0}
      <div class="mt-s4 rounded-md border border-amber-300/60 bg-amber-50 px-s3 py-s2 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
        {data.live.errors[0]}
      </div>
    {/if}

    {#if data.live.availability}
      <div class="mt-s6">
        <a
          href={`/member/bookings/new?offering=${data.offering.slug}`}
          class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-s4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {data.offering.ctaLabel}
        </a>
      </div>
    {/if}
  </Card>
</div>
