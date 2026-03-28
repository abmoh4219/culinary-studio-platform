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
  <Card className="p-s6 md:p-s8">
    <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Member Workspace</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Browse Offerings</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">
      Discover memberships, single-seat classes, personal coaching, and value-added services using live pricing and
      availability endpoints.
    </p>
    <div class="mt-s5 flex flex-wrap gap-s2">
      <a
        href="/member/bookings/manage"
        class="inline-flex h-10 items-center justify-center rounded-md border px-s4 text-sm font-medium transition-colors hover:bg-muted"
      >
        Manage existing booking
      </a>
      <a
        href="/member/recipe-player"
        class="inline-flex h-10 items-center justify-center rounded-md border px-s4 text-sm font-medium transition-colors hover:bg-muted"
      >
        Open recipe player
      </a>
    </div>
  </Card>

  {#each data.categories as section}
    <section class="space-y-s3">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">{section.title}</h2>
        <p class="text-sm text-muted-foreground">{section.description}</p>
      </div>

      <div class="grid gap-s4 md:grid-cols-2 xl:grid-cols-3">
        {#each section.items as offering}
          <Card className="flex h-full flex-col p-s5 surface-transition">
            <p class="text-xs uppercase tracking-wide text-muted-foreground">{offering.category.replace('-', ' ')}</p>
            <h3 class="mt-s2 text-lg font-semibold leading-tight">{offering.title}</h3>
            <p class="mt-s2 text-sm text-muted-foreground">{offering.shortDescription}</p>

            <div class="mt-s4 space-y-s2 text-sm">
              {#if offering.live.price}
                <p>
                  <span class="text-muted-foreground">Price:</span>
                  <span class="font-medium">
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
                <p>
                  <span class="text-muted-foreground">Availability:</span>
                  <span class={offering.live.availability.isBookableNow ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-amber-600 dark:text-amber-400'}>
                    {offering.live.availability.remainingCapacity}/{offering.live.availability.capacity} seats left
                  </span>
                </p>
              {/if}

              {#if offering.live.errors.length > 0}
                <p class="text-xs text-muted-foreground">{offering.live.errors[0]}</p>
              {/if}
            </div>

            <div class="mt-s5 flex gap-s2">
              <a
                href={`/member/offerings/${offering.slug}`}
                class="inline-flex h-10 items-center justify-center rounded-md border px-s4 text-sm font-medium transition-colors hover:bg-muted"
              >
                View details
              </a>
              {#if offering.live.availability}
                <a
                  href={`/member/bookings/new?offering=${offering.slug}`}
                  class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-s4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
