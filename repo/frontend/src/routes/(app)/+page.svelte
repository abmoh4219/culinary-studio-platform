<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { TableShell } from '$lib/components/ui/table';

  const metricCards = [
    { label: 'Session Throughput', value: '1,842', trend: '+12.4%' },
    { label: 'Pipeline Health', value: '98.6%', trend: '+0.8%' },
    { label: 'Deploy Cadence', value: '17 / week', trend: '+2.1%' },
    { label: 'Queue Backlog', value: '23', trend: '-6.7%' }
  ];

  const activityHeaders = ['Segment', 'Status', 'Updated'];
  const activityRows = [
    ['Onboarding shell', 'Ready', '5 min ago'],
    ['Auth guard stubs', 'Ready', '12 min ago'],
    ['Design system layer', 'Ready', '20 min ago'],
    ['QA polish pass', 'In review', '32 min ago']
  ];

  let loading = true;

  onMount(() => {
    const timer = setTimeout(() => {
      loading = false;
    }, 650);

    return () => clearTimeout(timer);
  });
</script>

<div class="space-y-s6">
  <Card className="p-s6 md:p-s8">
    <div class="flex flex-wrap items-start justify-between gap-s4">
      <div>
        <p class="section-eyebrow">Studio Operations</p>
        <h2 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Command Surface</h2>
        <p class="mt-s3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Monitor momentum across bookings, workflows, and reliability signals in one polished workspace.
        </p>
      </div>
      <Button variant="secondary" on:click={() => toast.success('Action completed', { description: 'Global notifications are active.' })}>
        Trigger Toast
      </Button>
    </div>
  </Card>

  <section class="grid gap-s4 sm:grid-cols-2 xl:grid-cols-4">
    {#if loading}
      {#each Array.from({ length: 4 }) as _item}
        <Card className="p-s5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-s4 h-8 w-24" />
          <Skeleton className="mt-s3 h-3 w-20" />
        </Card>
      {/each}
    {:else}
      {#each metricCards as card}
        <Card className="p-s5">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p class="mt-s3 text-2xl font-semibold">{card.value}</p>
          <p class="mt-s2 text-xs text-emerald-600 dark:text-emerald-400">{card.trend}</p>
        </Card>
      {/each}
    {/if}
  </section>

  <section class="grid gap-s4 xl:grid-cols-[1.5fr_1fr]">
    <Card className="p-s6">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operational Notes</h3>
      <div class="mt-s4 space-y-s3">
        {#if loading}
          {#each Array.from({ length: 3 }) as _row}
            <div class="glass-panel p-s4">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="mt-s3 h-3 w-3/4" />
            </div>
          {/each}
        {:else}
          <div class="glass-panel px-s4 py-s4">Design tokens now align with the sign-in experience: atmospheric surfaces, cyan accent discipline, and consistent hierarchy.</div>
          <div class="glass-panel px-s4 py-s4">Motion remains subtle and respects reduced-motion preferences.</div>
          <div class="glass-panel px-s4 py-s4">Role-guarded route groups continue to protect workspace access.</div>
        {/if}
      </div>
    </Card>

    <Card className="p-s6">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Table Shell</h3>
      <div class="mt-s4">
        {#if loading}
          <div class="rounded-lg border p-s4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-s3 h-4 w-full" />
            <Skeleton className="mt-s3 h-4 w-full" />
          </div>
        {:else}
          <TableShell headers={activityHeaders} rows={activityRows} />
        {/if}
      </div>
    </Card>
  </section>
</div>
