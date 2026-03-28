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

<div class="space-y-s8 pb-s12">
  <div class="flex flex-wrap items-center justify-between gap-s3">
    <a href="/" class="inline-flex items-center gap-s2 rounded-full border border-border/70 bg-card/60 px-s3 py-s2 text-sm text-muted-foreground surface-transition hover:bg-muted/60 hover:text-foreground">
      ← Back to shell
    </a>
    <p class="section-eyebrow">Member Workspace</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <p class="section-eyebrow">Offerings Hub</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Browse and book live offerings</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">
      Explore memberships, single-seat classes, personal coaching, and value-added services with real-time pricing and
      availability snapshots.
    </p>
    <div class="mt-s5 flex flex-wrap gap-s2">
      <a
        href="/member/bookings/manage"
        class="inline-flex h-10 items-center justify-center rounded-md border border-border/75 bg-card/75 px-s4 text-sm font-medium surface-transition hover:bg-muted"
      >
        Manage existing booking
      </a>
      <a
        href="/member/recipe-player"
        class="inline-flex h-10 items-center justify-center rounded-md border border-border/75 bg-card/75 px-s4 text-sm font-medium surface-transition hover:bg-muted"
      >
        Open recipe player
      </a>
      <a
        href="/member/notifications"
        class="inline-flex h-10 items-center justify-center rounded-md border border-border/75 bg-card/75 px-s4 text-sm font-medium surface-transition hover:bg-muted"
      >
        Notification center
      </a>
    </div>
  </Card>

  {#each data.categories as section}
    <section class="space-y-s4">
      <div class="space-y-s2">
        <p class="section-eyebrow">{section.title}</p>
        <p class="max-w-3xl text-sm text-muted-foreground">{section.description}</p>
      </div>

      <div class="grid gap-s4 md:grid-cols-2 xl:grid-cols-3">
        {#each section.items as offering}
          <Card className="flex h-full flex-col p-s5">
            <p class="text-xs uppercase tracking-[0.16em] text-muted-foreground">{offering.category.replace('-', ' ')}</p>
            <h3 class="mt-s2 text-lg font-semibold leading-tight">{offering.title}</h3>
            <p class="mt-s2 text-sm text-muted-foreground">{offering.shortDescription}</p>

            <div class="mt-s4 space-y-s2 rounded-lg border border-border/70 bg-background/30 p-s3 text-sm">
              {#if offering.live.price}
                <p>
                  <span class="text-muted-foreground">Price:</span>
                  <span class="font-medium text-foreground">
                    {money(offering.live.price.amount, offering.live.price.currency)}
                  </span>
                </p>
                <p class="text-xs text-muted-foreground">
                  Tax {money(offering.live.price.taxAmount, offering.live.price.currency)} via {offering.live.price.sourceLabel}
                </p>
              {:else}
                <p class="text-muted-foreground">Live price currently unavailable.</p>
              {/if}

              {#if offering.live.availability}
                <p class="flex flex-wrap items-center gap-s2">
                  <span class="text-muted-foreground">Availability:</span>
                  <span class={offering.live.availability.isBookableNow ? 'status-pill border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'status-pill border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'}>
                    {offering.live.availability.remainingCapacity}/{offering.live.availability.capacity} seats left
                  </span>
                </p>
              {/if}

              {#if offering.live.errors.length > 0}
                <p class="text-xs text-muted-foreground">{offering.live.errors[0]}</p>
              {/if}
            </div>

            <div class="mt-s5 flex flex-wrap gap-s2">
              <a
                href={`/member/offerings/${offering.slug}`}
                class="inline-flex h-10 items-center justify-center rounded-md border border-border/75 bg-card/70 px-s4 text-sm font-medium surface-transition hover:bg-muted"
              >
                View details
              </a>
              {#if offering.live.availability}
                <a
                  href={`/member/bookings/new?offering=${offering.slug}`}
                  class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-s4 text-sm font-medium text-primary-foreground shadow-sm surface-transition hover:bg-primary/90"
                >
                  {offering.ctaLabel}
                </a>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    </section>
  {/each}
</div>
