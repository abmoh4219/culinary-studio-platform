<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let data: any;
  export let form: any;

  const scenarios = [
    'BOOKING_SUCCESS',
    'CANCELLATION',
    'WAITLIST_PROMOTION',
    'WEBHOOK_FAILURE'
  ];

  const statuses = ['QUEUED', 'SENT', 'FAILED', 'CANCELED'];

  let globalMuted = data.preference.globalMuted;
  let mutedCategories = new Set<string>(data.preference.mutedCategories);

  $: if (form?.action === 'updatePreferences' && form?.success) {
    globalMuted = form.preference.globalMuted;
    mutedCategories = new Set(form.preference.mutedCategories);
    toast.success('Notification preferences updated');
  }

  $: if (form?.action && !form?.success && form?.message) {
    toast.error('Notification center action failed', { description: form.message });
  }

  onMount(() => {
    if (form?.action === 'refresh' && form?.success) {
      toast.success('Notification feed refreshed');
    }
  });

  function formatTimestamp(value: string | null): string {
    return value ? new Date(value).toLocaleString() : 'Not available';
  }

  function payloadEntries(payload: Record<string, unknown> | null | undefined): Array<[string, string]> {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    return Object.entries(payload)
      .slice(0, 4)
      .map(([key, value]) => [key, typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '[structured]']);
  }

  function toggleCategory(category: string, checked: boolean): void {
    const next = new Set(mutedCategories);
    if (checked) {
      next.add(category);
    } else {
      next.delete(category);
    }
    mutedCategories = next;
  }
</script>

<div class="space-y-s8 pb-s12">
  <div class="flex flex-wrap items-center justify-between gap-s3">
    <a href="/member" class="inline-flex items-center gap-s2 rounded-full border border-border/70 bg-card/60 px-s3 py-s2 text-sm text-muted-foreground surface-transition hover:bg-muted/60 hover:text-foreground">
      ← Back to member workspace
    </a>
    <p class="section-eyebrow">Notification Center</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <p class="section-eyebrow">History + Preferences</p>
    <h1 class="mt-s2 text-2xl font-semibold tracking-tight md:text-3xl">Track deliveries and tune what reaches you</h1>
    <p class="mt-s3 max-w-3xl text-sm text-muted-foreground md:text-base">
      Review delivery status, booking and workflow alerts, and mute categories you do not want sent into your member workspace.
    </p>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[0.95fr_1.25fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Mute controls</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Preferences apply to existing backend notification APIs and update immediately.</p>

      <form method="POST" action="?/updatePreferences" class="mt-s4 space-y-s4 rounded-lg border border-border/70 bg-background/35 p-s4">
        <label class="flex items-center justify-between gap-s3 rounded-md border border-border/70 bg-card/60 px-s3 py-s3 text-sm">
          <span>
            <span class="block font-medium">Mute all notifications</span>
            <span class="block text-xs text-muted-foreground">Keep your inbox quiet until you re-enable alerts.</span>
          </span>
          <input type="checkbox" name="globalMuted" bind:checked={globalMuted} class="h-4 w-4 accent-primary" />
        </label>

        <div class="space-y-s2">
          <p class="text-sm font-medium">Muted categories</p>
          <div class="grid gap-s2 sm:grid-cols-2">
            {#each scenarios as scenario}
              <label class="flex items-center gap-s2 rounded-md border border-border/70 px-s3 py-s2 text-sm">
                <input
                  type="checkbox"
                  name="mutedCategories"
                  value={scenario}
                  checked={mutedCategories.has(scenario)}
                  on:change={(event) => toggleCategory(scenario, (event.currentTarget as HTMLInputElement).checked)}
                  class="h-4 w-4 accent-primary"
                />
                <span>{scenario.replaceAll('_', ' ')}</span>
              </label>
            {/each}
          </div>
        </div>

        <div class="rounded-md border border-border/70 bg-card/55 px-s3 py-s2 text-xs text-muted-foreground">
          Last updated {formatTimestamp(data.preference.updatedAt)}
        </div>

        <Button type="submit">Save preferences</Button>
      </form>
    </Card>

    <Card className="p-s5">
      <div class="flex flex-wrap items-center justify-between gap-s3">
        <div>
          <h2 class="text-base font-semibold">Notification history</h2>
          <p class="mt-s1 text-sm text-muted-foreground">Filter your inbox, inspect delivery outcomes, and refresh live status.</p>
        </div>
        <form method="POST" action="?/refresh">
          <Button type="submit" variant="secondary">Refresh</Button>
        </form>
      </div>

      <form method="GET" class="mt-s4 grid gap-s3 rounded-lg border border-border/70 bg-background/35 p-s4 md:grid-cols-2 xl:grid-cols-3">
        <div class="space-y-s2">
          <Label for="filter-scenario">Scenario</Label>
          <select id="filter-scenario" name="scenario" class="field-select">
            <option value="">All scenarios</option>
            {#each scenarios as scenario}
              <option value={scenario} selected={data.filterValues.scenario === scenario}>{scenario}</option>
            {/each}
          </select>
        </div>
        <div class="space-y-s2">
          <Label for="filter-status">Status</Label>
          <select id="filter-status" name="status" class="field-select">
            <option value="">All statuses</option>
            {#each statuses as status}
              <option value={status} selected={data.filterValues.status === status}>{status}</option>
            {/each}
          </select>
        </div>
        <div class="space-y-s2">
          <Label for="filter-limit">Limit</Label>
          <Input id="filter-limit" name="limit" value={data.filterValues.limit} />
        </div>
        <div class="space-y-s2">
          <Label for="filter-from">From (ISO)</Label>
          <Input id="filter-from" name="from" value={data.filterValues.from} placeholder="2026-03-01T00:00:00.000Z" />
        </div>
        <div class="space-y-s2">
          <Label for="filter-to">To (ISO)</Label>
          <Input id="filter-to" name="to" value={data.filterValues.to} placeholder="2026-03-31T23:59:59.000Z" />
        </div>
        <div class="flex items-end">
          <Button type="submit" className="w-full">Apply filters</Button>
        </div>
      </form>

      <div class="mt-s4 space-y-s3">
        {#if data.history.notifications.length === 0}
          <div class="rounded-lg border border-dashed border-border/70 bg-background/30 px-s4 py-s5 text-sm text-muted-foreground">
            No notifications match the current filters.
          </div>
        {:else}
          {#each data.history.notifications as notification}
            <article class="rounded-xl border border-border/70 bg-background/40 p-s4 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.45)]">
              <div class="flex flex-wrap items-start justify-between gap-s3">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">{notification.scenario.replaceAll('_', ' ')}</p>
                  <h3 class="mt-s2 text-base font-semibold">{notification.subject ?? 'System notification'}</h3>
                </div>
                <span class="status-pill border-border/70 bg-card/60 text-foreground">{notification.status}</span>
              </div>

              <div class="mt-s3 grid gap-s2 text-sm text-muted-foreground md:grid-cols-2">
                <p><span class="text-foreground">Channel:</span> {notification.channel}</p>
                <p><span class="text-foreground">Created:</span> {formatTimestamp(notification.createdAt)}</p>
                <p><span class="text-foreground">Scheduled:</span> {formatTimestamp(notification.scheduledFor)}</p>
                <p><span class="text-foreground">Sent:</span> {formatTimestamp(notification.sentAt)}</p>
              </div>

              {#if notification.failureReason}
                <div class="mt-s3 rounded-md border border-amber-400/40 bg-amber-500/10 px-s3 py-s2 text-sm text-amber-900 dark:text-amber-200">
                  {notification.failureReason}
                </div>
              {/if}

              {#if payloadEntries(notification.payloadJson).length > 0}
                <dl class="mt-s3 grid gap-s2 rounded-md border border-border/70 bg-card/55 p-s3 text-sm md:grid-cols-2">
                  {#each payloadEntries(notification.payloadJson) as [key, value]}
                    <div>
                      <dt class="text-xs uppercase tracking-[0.16em] text-muted-foreground">{key}</dt>
                      <dd class="mt-1 font-medium text-foreground">{value}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
            </article>
          {/each}
        {/if}
      </div>
    </Card>
  </div>
</div>
