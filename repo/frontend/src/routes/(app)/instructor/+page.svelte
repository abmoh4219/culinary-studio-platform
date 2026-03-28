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

  let recipeId = '';
  let bookingId = '';
  let rollbackReason = 'Instructor requested step rollback';

  let scheduleBookingId = '';
  let newSessionKey = '';
  let newSeatKey = '';
  let newStartAt = '';
  let newEndAt = '';
  let scheduleCapacity = '12';

  let cancelBookingId = '';
  let cancelBaseAmount = '';
  let cancelCapacity = '12';

  let monitorSessionKey = data.monitoring.params.sessionKey || '';
  let monitorStartAt = data.monitoring.params.startAt || '';
  let monitorEndAt = data.monitoring.params.endAt || '';
  let monitorCapacity = data.monitoring.params.capacity || '12';

  $: selectedRun = form?.action === 'runControl' && form?.success && form.run
    ? {
        run: form.run,
        progress: form.progress
      }
    : data.selectedRun;

  $: cancelPreview = form?.action === 'previewCancellation' && form?.success ? form.preview : null;
  $: cancelResult = form?.action === 'confirmCancellation' && form?.success ? form.cancellation : null;
  $: rescheduleResult = form?.action === 'rescheduleSession' && form?.success ? form.reschedule : null;
  $: createRunResult = form?.action === 'createClassRun' && form?.success ? form.run : null;

  $: if (form?.action && !form?.success && form?.message) {
    toast.error('Action failed', { description: form.message });
  }

  $: if (createRunResult) {
    toast.success('Class run created', { description: `Run ${createRunResult.id}` });
  }

  $: if (rescheduleResult?.booking) {
    toast.success('Session rescheduled', { description: `Booking ${rescheduleResult.booking.id} updated` });
  }

  $: if (cancelResult?.canceledBookingId) {
    toast.success('Session canceled', { description: `Booking ${cancelResult.canceledBookingId}` });
  }

  onMount(() => {
    const timer = setInterval(() => {
      if (monitorSessionKey && monitorStartAt && monitorEndAt) {
        invalidateAll();
      }
    }, 15000);

    return () => clearInterval(timer);
  });

  function attendancePercent(active: number, capacity: number): number {
    if (!capacity || capacity <= 0) return 0;
    return Math.min(100, Math.round((active / capacity) * 100));
  }
</script>

<div class="space-y-s6 pb-s12">
  <div class="flex items-center justify-between gap-s3">
    <a href="/" class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      ← Back to shell
    </a>
    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Instructor Workspace</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Class Management</h1>
    <p class="mt-s2 max-w-3xl text-sm text-muted-foreground md:text-base">
      Manage assigned class runs, push schedule changes through booking endpoints, and monitor session capacity and attendance.
    </p>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1.6fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Assigned or active classes</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Runs from workflow active endpoint.</p>

      <div class="mt-s4 space-y-s2">
        {#if data.activeRuns.length === 0}
          <p class="text-sm text-muted-foreground">No active classes found.</p>
        {:else}
          {#each data.activeRuns as run}
            <a
              href={`/instructor?runId=${run.id}&sessionKey=${encodeURIComponent(monitorSessionKey)}&startAt=${encodeURIComponent(monitorStartAt)}&endAt=${encodeURIComponent(monitorEndAt)}&capacity=${encodeURIComponent(monitorCapacity)}`}
              class="block rounded-md border px-s3 py-s3 transition-colors hover:bg-muted {data.selectedRunId === run.id ? 'bg-muted' : ''}"
            >
              <p class="text-sm font-medium">Run {run.id.slice(0, 8)}…</p>
              <p class="mt-1 text-xs text-muted-foreground">Recipe {run.recipeId.slice(0, 8)}… · {run.status}</p>
            </a>
          {/each}
        {/if}
      </div>

      <form method="POST" action="?/createClassRun" class="mt-s5 space-y-s3 rounded-lg border bg-background/70 p-s4">
        <p class="text-sm font-semibold">Create class run</p>
        <div class="space-y-s2">
          <Label for="create-recipe-id">Recipe ID</Label>
          <Input id="create-recipe-id" name="recipeId" bind:value={recipeId} aria-invalid={form?.fields?.recipeId ? 'true' : 'false'} />
          {#if form?.fields?.recipeId}
            <p class="text-xs text-red-600 dark:text-red-400">{form.fields.recipeId}</p>
          {/if}
        </div>
        <div class="space-y-s2">
          <Label for="create-booking-id">Booking ID (optional)</Label>
          <Input id="create-booking-id" name="bookingId" bind:value={bookingId} />
        </div>
        <Button type="submit" className="h-12 w-full">Start class run</Button>
      </form>
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Run controls</h2>

      {#if selectedRun}
        <div class="mt-s3 space-y-s3">
          <div class="rounded-lg border bg-background/70 p-s3">
            <p class="text-sm">Run ID: <span class="font-medium">{selectedRun.run.id}</span></p>
            <p class="mt-1 text-sm text-muted-foreground">
              Status: {selectedRun.run.status} · Phase {selectedRun.run.currentPhaseNumber ?? '-'} ·
              Progress {selectedRun.progress?.terminalSteps ?? '-'} / {selectedRun.progress?.totalSteps ?? '-'}
            </p>
          </div>

          <div class="grid gap-s2 sm:grid-cols-3">
            <form method="POST" action="?/runControl">
              <input type="hidden" name="runId" value={selectedRun.run.id} />
              <input type="hidden" name="actionKind" value="pause" />
              <Button className="h-12 w-full" type="submit" variant="secondary">Pause</Button>
            </form>
            <form method="POST" action="?/runControl">
              <input type="hidden" name="runId" value={selectedRun.run.id} />
              <input type="hidden" name="actionKind" value="resume" />
              <Button className="h-12 w-full" type="submit" variant="secondary">Resume</Button>
            </form>
            <form method="POST" action="?/runControl">
              <input type="hidden" name="runId" value={selectedRun.run.id} />
              <input type="hidden" name="actionKind" value="tick" />
              <Button className="h-12 w-full" type="submit" variant="ghost">Tick</Button>
            </form>
          </div>

          <div class="grid gap-s3 md:grid-cols-2">
            <form method="POST" action="?/runControl" class="space-y-s2 rounded-md border bg-background/70 p-s3">
              <p class="text-sm font-medium">Complete step</p>
              <input type="hidden" name="runId" value={selectedRun.run.id} />
              <input type="hidden" name="actionKind" value="complete" />
              <select name="runStepId" class="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {#each selectedRun.run.steps as step}
                  <option value={step.id}>{step.phaseNumber}.{step.positionInPhase} - {step.titleSnapshot} ({step.status})</option>
                {/each}
              </select>
              <Button type="submit" className="w-full">Complete selected step</Button>
            </form>

            <form method="POST" action="?/runControl" class="space-y-s2 rounded-md border bg-background/70 p-s3">
              <p class="text-sm font-medium">Rollback step</p>
              <input type="hidden" name="runId" value={selectedRun.run.id} />
              <input type="hidden" name="actionKind" value="rollback" />
              <select name="runStepId" class="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {#each selectedRun.run.steps as step}
                  <option value={step.id}>{step.phaseNumber}.{step.positionInPhase} - {step.titleSnapshot} ({step.status})</option>
                {/each}
              </select>
              <Input name="reason" bind:value={rollbackReason} placeholder="Rollback reason" />
              <Button type="submit" variant="ghost" className="w-full">Rollback selected step</Button>
            </form>
          </div>
        </div>
      {:else}
        <p class="mt-s3 text-sm text-muted-foreground">Select a class run to control it.</p>
      {/if}
    </Card>
  </div>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Schedule changes</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Update class schedule via booking reschedule endpoint.</p>

      <form method="POST" action="?/rescheduleSession" class="mt-s4 space-y-s3">
        <div class="space-y-s2">
          <Label for="schedule-booking-id">Booking ID</Label>
          <Input id="schedule-booking-id" name="bookingId" bind:value={scheduleBookingId} aria-invalid={form?.fields?.bookingId ? 'true' : 'false'} />
          {#if form?.fields?.bookingId}
            <p class="text-xs text-red-600 dark:text-red-400">{form.fields.bookingId}</p>
          {/if}
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="new-session-key">New session key</Label>
            <Input id="new-session-key" name="newSessionKey" bind:value={newSessionKey} aria-invalid={form?.fields?.newSessionKey ? 'true' : 'false'} />
          </div>
          <div class="space-y-s2">
            <Label for="new-seat-key">New seat key</Label>
            <Input id="new-seat-key" name="newSeatKey" bind:value={newSeatKey} aria-invalid={form?.fields?.newSeatKey ? 'true' : 'false'} />
          </div>
        </div>

        <div class="grid gap-s3 md:grid-cols-2">
          <div class="space-y-s2">
            <Label for="new-start">New start (ISO)</Label>
            <Input id="new-start" name="newStartAt" bind:value={newStartAt} placeholder="2026-04-02T17:00:00.000Z" />
          </div>
          <div class="space-y-s2">
            <Label for="new-end">New end (ISO)</Label>
            <Input id="new-end" name="newEndAt" bind:value={newEndAt} placeholder="2026-04-02T18:30:00.000Z" />
          </div>
        </div>

        <div class="space-y-s2">
          <Label for="schedule-capacity">Capacity</Label>
          <Input id="schedule-capacity" name="capacity" bind:value={scheduleCapacity} />
        </div>

        <Button type="submit">Apply schedule update</Button>
      </form>

      {#if rescheduleResult?.booking}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Updated booking {rescheduleResult.booking.id} to {rescheduleResult.booking.sessionKey} / {rescheduleResult.booking.seatKey}.
        </div>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Cancel class session</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Preview policy and fee, then confirm cancel.</p>

      <form method="POST" action="?/previewCancellation" class="mt-s4 space-y-s3">
        <div class="space-y-s2">
          <Label for="cancel-booking-id">Booking ID</Label>
          <Input id="cancel-booking-id" name="bookingId" bind:value={cancelBookingId} />
        </div>
        <div class="space-y-s2">
          <Label for="cancel-base">Base amount (optional)</Label>
          <Input id="cancel-base" name="baseAmount" bind:value={cancelBaseAmount} />
        </div>
        <Button type="submit" variant="secondary">Preview cancellation</Button>
      </form>

      {#if cancelPreview}
        <div class="mt-s4 rounded-md border bg-background/70 p-s3 text-sm">
          <p>Policy: <span class="font-medium">{cancelPreview.preview.policyBand}</span></p>
          <p class="mt-1">Fee: <span class="font-medium">{cancelPreview.preview.feePercent}%</span></p>
          <p class="mt-1">Amount: <span class="font-medium">${cancelPreview.preview.feeAmount.toFixed(2)}</span></p>
        </div>
      {/if}

      <form method="POST" action="?/confirmCancellation" class="mt-s4 space-y-s3">
        <input type="hidden" name="bookingId" value={cancelBookingId} />
        <input type="hidden" name="baseAmount" value={cancelBaseAmount} />
        <div class="space-y-s2">
          <Label for="cancel-capacity">Capacity</Label>
          <Input id="cancel-capacity" name="capacity" bind:value={cancelCapacity} />
        </div>
        <Button type="submit" disabled={!cancelPreview}>Confirm cancel</Button>
      </form>

      {#if cancelResult}
        <div class="mt-s4 rounded-md border border-emerald-300/60 bg-emerald-50 px-s3 py-s2 text-sm text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          Canceled booking {cancelResult.canceledBookingId}. Fee ${cancelResult.feePreview.feeAmount.toFixed(2)}.
        </div>
      {/if}
    </Card>
  </div>

  <Card className="p-s5">
    <h2 class="text-base font-semibold">Session monitoring</h2>
    <p class="mt-s1 text-sm text-muted-foreground">Near-live attendance, capacity, and queue status.</p>

    <form method="GET" class="mt-s4 grid gap-s3 md:grid-cols-2 xl:grid-cols-4">
      <div class="space-y-s2">
        <Label for="monitor-session-key">Session key</Label>
        <Input id="monitor-session-key" name="sessionKey" bind:value={monitorSessionKey} />
      </div>
      <div class="space-y-s2">
        <Label for="monitor-start">Start (ISO)</Label>
        <Input id="monitor-start" name="startAt" bind:value={monitorStartAt} placeholder="2026-04-02T17:00:00.000Z" />
      </div>
      <div class="space-y-s2">
        <Label for="monitor-end">End (ISO)</Label>
        <Input id="monitor-end" name="endAt" bind:value={monitorEndAt} placeholder="2026-04-02T18:30:00.000Z" />
      </div>
      <div class="space-y-s2">
        <Label for="monitor-capacity">Capacity</Label>
        <Input id="monitor-capacity" name="capacity" bind:value={monitorCapacity} />
      </div>
      {#if data.selectedRunId}
        <input type="hidden" name="runId" value={data.selectedRunId} />
      {/if}
      <div class="md:col-span-2 xl:col-span-4">
        <Button type="submit" className="h-12">Load session telemetry</Button>
      </div>
    </form>

    {#if data.monitoring.error}
      <div class="mt-s4 rounded-md border border-red-300/60 bg-red-50 px-s3 py-s2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-200">
        {data.monitoring.error}
      </div>
    {/if}

    {#if data.monitoring.availability}
      <div class="mt-s4 grid gap-s3 md:grid-cols-3">
        <div class="rounded-md border bg-background/70 p-s3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Active attendance</p>
          <p class="mt-1 text-2xl font-semibold">{data.monitoring.availability.activeBookings}</p>
        </div>
        <div class="rounded-md border bg-background/70 p-s3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Remaining capacity</p>
          <p class="mt-1 text-2xl font-semibold">{data.monitoring.availability.remainingCapacity}</p>
        </div>
        <div class="rounded-md border bg-background/70 p-s3">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Fill rate</p>
          <p class="mt-1 text-2xl font-semibold">
            {attendancePercent(data.monitoring.availability.activeBookings, data.monitoring.availability.capacity)}%
          </p>
        </div>
      </div>

      <div class="mt-s4 rounded-md border bg-background/70 p-s3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">Waitlist status</p>
          <p class="text-xs text-muted-foreground">{data.monitoring.waitlist?.entries.length ?? 0} entries</p>
        </div>

        {#if data.monitoring.waitlist && data.monitoring.waitlist.entries.length > 0}
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
                {#each data.monitoring.waitlist.entries as entry}
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
          <p class="mt-s3 text-sm text-muted-foreground">No waitlist activity for this session window.</p>
        {/if}
      </div>
    {/if}
  </Card>
</div>
