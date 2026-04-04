<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { prefersReducedMotion } from '$lib/motion';

  import type { PageData } from './$types';

  export let data: PageData;

  type RunState = NonNullable<PageData['runState']>;
  type Timeline = NonNullable<PageData['timeline']>;

  const TICK_INTERVAL_MS = 2000;

  let runState: RunState | null = data.runState;
  let timeline: Timeline | null = data.timeline;
  let selectedRunId = data.selectedRunId;
  let loadError: string | null = data.loadError;

  let recipeIdInput = '';
  let recipeSearch = '';
  let bookingIdInput = '';
  let rollbackReason = 'Manual back navigation from player controls';

  let isCreatingRun = false;
  let isMutating = false;
  let nowMs = Date.now();

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let lastSpokenStepId: string | null = null;

  $: recipeOptions = data.recipes ?? [];
  $: filteredRecipes = recipeOptions
    .filter((recipe) => {
      const q = recipeSearch.trim().toLowerCase();
      if (!q) {
        return true;
      }

      return (
        recipe.name.toLowerCase().includes(q) ||
        recipe.code.toLowerCase().includes(q) ||
        recipe.id.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  function statusTone(status: string): string {
    if (status === 'RUNNING') return 'text-emerald-600 dark:text-emerald-400';
    if (status === 'PAUSED') return 'text-amber-600 dark:text-amber-400';
    if (status === 'COMPLETED') return 'text-blue-600 dark:text-blue-400';
    return 'text-muted-foreground';
  }

  function stepOrderValue(step: { phaseNumber: number; positionInPhase: number }): number {
    return step.phaseNumber * 10_000 + step.positionInPhase;
  }

  $: currentStep =
    runState?.run.steps
      .filter((step) => step.status === 'RUNNING' || step.status === 'READY')
      .sort((a, b) => stepOrderValue(a) - stepOrderValue(b))[0] ?? null;

  $: lastCompletedStep =
    runState?.run.steps
      .filter((step) => step.status === 'COMPLETED')
      .sort((a, b) => stepOrderValue(b) - stepOrderValue(a))[0] ?? null;

  $: currentCue =
    timeline && currentStep
      ? timeline.timeline.segments
          .flatMap((segment) => segment.branches)
          .find((branch) => branch.stepId === currentStep.recipeStepId)?.nodes?.find((node) => node.type === 'STEP')
          ?.cue
      : null;

  $: countdownSeconds = (() => {
    if (!currentStep) {
      return null;
    }

    if (currentStep.status === 'READY') {
      return currentStep.pausedRemainingSeconds ?? 0;
    }

    if (!currentStep.timerTargetAt) {
      return null;
    }

    return Math.max(0, Math.ceil((new Date(currentStep.timerTargetAt).getTime() - nowMs) / 1000));
  })();

  function formatSeconds(value: number | null): string {
    if (value === null) {
      return '--:--';
    }

    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function ttsSpeakCurrentStep(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (!currentStep || currentStep.id === lastSpokenStepId) {
      return;
    }

    const parts = [
      `Now on step ${currentStep.phaseNumber}.${currentStep.positionInPhase}: ${currentStep.titleSnapshot}.`
    ];

    if (currentCue?.text) {
      parts.push(currentCue.text);
    }

    if (currentCue?.targetTempC !== undefined) {
      parts.push(`Target temperature ${currentCue.targetTempC} degrees Celsius.`);
    }

    if (currentCue?.heatLevel) {
      parts.push(`Heat level ${currentCue.heatLevel}.`);
    }

    const utterance = new SpeechSynthesisUtterance(parts.join(' '));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    lastSpokenStepId = currentStep.id;
  }

  async function callWorkflowApi<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const response = await fetch(`${data.apiBaseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message || response.statusText || 'Request failed');
    }

    return (await response.json()) as T;
  }

  async function refreshRun(runId: string): Promise<void> {
    const state = await callWorkflowApi<RunState>(`/workflows/runs/${encodeURIComponent(runId)}`, 'GET');
    const timelineData = await callWorkflowApi<Timeline>(
      `/workflows/recipes/${encodeURIComponent(state.run.recipeId)}/timeline`,
      'GET'
    );

    runState = state;
    timeline = timelineData;
    selectedRunId = state.run.id;
    loadError = null;
  }

  async function selectRun(runId: string): Promise<void> {
    try {
      await refreshRun(runId);
      await goto(`/member/recipe-player?runId=${encodeURIComponent(runId)}`, { replaceState: true, noScroll: true });
    } catch (error) {
      toast.error('Unable to load run', { description: (error as Error).message });
    }
  }

  async function createRun(): Promise<void> {
    if (!recipeIdInput.trim()) {
      toast.error('Recipe ID is required');
      return;
    }

    isCreatingRun = true;
    try {
      const created = await callWorkflowApi<RunState>('/workflows/runs', 'POST', {
        recipeId: recipeIdInput.trim(),
        bookingId: bookingIdInput.trim() || undefined
      });

      recipeIdInput = '';
      bookingIdInput = '';

      await selectRun(created.run.id);
      toast.success('Workflow run started');
    } catch (error) {
      toast.error('Unable to start run', { description: (error as Error).message });
    } finally {
      isCreatingRun = false;
    }
  }

  async function mutateCurrentRun(action: () => Promise<RunState>, successMessage: string): Promise<void> {
    if (!runState || isMutating) {
      return;
    }

    isMutating = true;
    try {
      const next = await action();
      runState = next;
      toast.success(successMessage);
    } catch (error) {
      toast.error('Action failed', { description: (error as Error).message });
    } finally {
      isMutating = false;
    }
  }

  async function pauseOrResume(): Promise<void> {
    if (!runState) return;
    const runId = runState.run.id;
    const isPaused = runState.run.status === 'PAUSED';

    await mutateCurrentRun(
      () => callWorkflowApi<RunState>(`/workflows/runs/${encodeURIComponent(runId)}/${isPaused ? 'resume' : 'pause'}`, 'POST'),
      isPaused ? 'Run resumed' : 'Run paused'
    );
  }

  async function nextStep(): Promise<void> {
    if (!runState || !currentStep) return;
    const runId = runState.run.id;
    const stepId = currentStep.id;

    await mutateCurrentRun(
      () =>
        callWorkflowApi<RunState>(
          `/workflows/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/complete`,
          'POST'
        ),
      'Advanced to next step'
    );
  }

  async function backStep(): Promise<void> {
    if (!runState || !lastCompletedStep) return;
    const runId = runState.run.id;
    const stepId = lastCompletedStep.id;

    await mutateCurrentRun(
      () =>
        callWorkflowApi<RunState>(
          `/workflows/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/rollback`,
          'POST',
          {
            reason: rollbackReason
          }
        ),
      'Rolled back to previous step'
    );
  }

  async function tickRun(): Promise<void> {
    if (!runState || runState.run.status !== 'RUNNING') {
      return;
    }

    try {
      const next = await callWorkflowApi<RunState>(`/workflows/runs/${encodeURIComponent(runState.run.id)}/tick`, 'POST');
      runState = next;
    } catch (error) {
      loadError = (error as Error).message;
    }
  }

  onMount(() => {
    clockTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);

    tickTimer = setInterval(() => {
      void tickRun();
    }, TICK_INTERVAL_MS);
  });

  onDestroy(() => {
    if (clockTimer) clearInterval(clockTimer);
    if (tickTimer) clearInterval(tickTimer);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  });

  $: if (currentStep) {
    ttsSpeakCurrentStep();
  }
</script>

<div class="space-y-s6 pb-s12">
  <div class="flex items-center justify-between gap-s3">
    <a href="/member" class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      ← Back to member workspace
    </a>
    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recipe Player</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <div class="grid gap-s4 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Touch-first workflow player</h1>
        <p class="mt-s2 max-w-3xl text-sm text-muted-foreground md:text-base">
          Unified timeline playback with automatic timer ticks, rollback support, and spoken local TTS step guidance.
        </p>
        {#if runState}
          <p class="mt-s3 text-sm">
            Active run: <span class="font-medium">{runState.run.id}</span>
            ·
            <span class={statusTone(runState.run.status)}>{runState.run.status}</span>
          </p>
        {/if}
      </div>

      <form
        class="space-y-s3 rounded-lg border bg-background/70 p-s4"
        on:submit|preventDefault={createRun}
      >
        <p class="text-sm font-semibold">Start run</p>
        <div class="space-y-s2">
          <Label for="recipe-search">Recipe selector</Label>
          <Input id="recipe-search" bind:value={recipeSearch} placeholder="Search by recipe name or code" />
          {#if filteredRecipes.length > 0}
            <div class="max-h-44 space-y-1 overflow-auto rounded-md border bg-background p-s2">
              {#each filteredRecipes as recipe}
                <button
                  type="button"
                  class="w-full rounded-md border px-s3 py-s2 text-left text-sm transition-colors hover:bg-muted {recipe.id === recipeIdInput ? 'bg-muted' : ''}"
                  on:click={() => {
                    recipeIdInput = recipe.id;
                    recipeSearch = `${recipe.name} (${recipe.code})`;
                  }}
                >
                  <p class="font-medium">{recipe.name}</p>
                  <p class="text-xs text-muted-foreground">{recipe.code} · {recipe.difficulty}</p>
                </button>
              {/each}
            </div>
          {/if}
          <Input id="recipe-id" bind:value={recipeIdInput} placeholder="Selected recipe ID" readonly />
        </div>
        <div class="space-y-s2">
          <Label for="booking-id">Booking ID (optional)</Label>
          <Input id="booking-id" bind:value={bookingIdInput} placeholder="uuid" />
        </div>
        <Button className="h-12 w-full text-base" type="submit" disabled={isCreatingRun}>
          {isCreatingRun ? 'Starting...' : 'Start Workflow Run'}
        </Button>
      </form>
    </div>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1.6fr]">
    <Card className="p-s5">
      <p class="text-xs uppercase tracking-wide text-muted-foreground">Active Runs</p>
      <div class="mt-s3 space-y-s2">
        {#if data.activeRuns.length === 0}
          <p class="text-sm text-muted-foreground">No active runs yet.</p>
        {:else}
          {#each data.activeRuns as run}
            <button
              type="button"
              class="w-full rounded-md border px-s3 py-s3 text-left transition-colors hover:bg-muted {selectedRunId === run.id ? 'bg-muted' : ''}"
              on:click={() => selectRun(run.id)}
            >
              <p class="text-sm font-medium">{run.id.slice(0, 8)}…</p>
              <p class="mt-1 text-xs text-muted-foreground">Recipe {run.recipeId.slice(0, 8)}… · {run.status}</p>
            </button>
          {/each}
        {/if}
      </div>
    </Card>

    <Card className="p-s5">
      {#if !runState || !timeline}
        <p class="text-sm text-muted-foreground">Select or create a run to open the player.</p>
      {:else}
        <div class="space-y-s5">
          <div class="rounded-xl border bg-background/80 p-s4">
            <div class="flex flex-wrap items-center justify-between gap-s3">
              <div>
                <p class="text-xs uppercase tracking-wide text-muted-foreground">Current Step</p>
                <p class="mt-1 text-xl font-semibold">{currentStep ? currentStep.titleSnapshot : 'No active step'}</p>
              </div>
              <div class="text-right">
                <p class="text-xs uppercase tracking-wide text-muted-foreground">Timer</p>
                <p class="mt-1 text-3xl font-semibold tabular-nums">{formatSeconds(countdownSeconds)}</p>
              </div>
            </div>

            {#if currentCue}
              <div class="mt-s4 grid gap-s2 md:grid-cols-3">
                {#if currentCue.text}
                  <div class="rounded-md border bg-card p-s3 text-sm">
                    <p class="text-xs uppercase tracking-wide text-muted-foreground">Cue</p>
                    <p class="mt-1 font-medium">{currentCue.text}</p>
                  </div>
                {/if}
                {#if currentCue.targetTempC !== undefined}
                  <div class="rounded-md border border-amber-300/60 bg-amber-50 p-s3 text-sm dark:border-amber-700/40 dark:bg-amber-950/40">
                    <p class="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">Temperature</p>
                    <p class="mt-1 text-lg font-semibold text-amber-800 dark:text-amber-100">{currentCue.targetTempC} C</p>
                  </div>
                {/if}
                {#if currentCue.heatLevel}
                  <div class="rounded-md border border-red-300/60 bg-red-50 p-s3 text-sm dark:border-red-700/40 dark:bg-red-950/40">
                    <p class="text-xs uppercase tracking-wide text-red-700 dark:text-red-200">Heat</p>
                    <p class="mt-1 text-lg font-semibold text-red-800 dark:text-red-100">{currentCue.heatLevel}</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <div class="grid gap-s3 sm:grid-cols-3">
            <Button
              className="h-16 text-lg"
              variant="secondary"
              on:click={backStep}
              disabled={!lastCompletedStep || isMutating}
            >
              Back
            </Button>
            <Button className="h-16 text-lg" on:click={nextStep} disabled={!currentStep || isMutating}>Next</Button>
            <Button className="h-16 text-lg" variant="ghost" on:click={pauseOrResume} disabled={isMutating}>
              {runState.run.status === 'PAUSED' ? 'Resume' : 'Pause'}
            </Button>
          </div>

          <div class="rounded-lg border bg-background/70 p-s4">
            <div class="flex items-center justify-between">
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Unified Timeline</p>
              <p class="text-sm text-muted-foreground">{runState.progress.terminalSteps}/{runState.progress.totalSteps} done</p>
            </div>

            <div class="mt-s3 space-y-s3">
              {#each timeline.timeline.segments as segment}
                <div class="rounded-md border p-s3">
                  <p class="text-sm font-semibold">Phase {segment.phaseNumber}</p>
                  <div class="mt-s2 space-y-s2">
                    {#each segment.branches as branch}
                      {@const runStep = runState.run.steps.find((step) => step.recipeStepId === branch.stepId)}
                      <div
                        class="rounded-md border px-s3 py-s3 transition-colors {runStep?.status === 'RUNNING' ? 'border-primary bg-primary/10' : runStep?.status === 'COMPLETED' ? 'border-emerald-400/70 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-card'}"
                        style:transition-duration={$prefersReducedMotion ? '0ms' : '160ms'}
                      >
                        <div class="flex flex-wrap items-center justify-between gap-s2">
                          <p class="font-medium">{branch.title}</p>
                          <p class="text-xs text-muted-foreground">{runStep?.status ?? 'PENDING'}</p>
                        </div>
                        <div class="mt-1 flex flex-wrap gap-s2 text-xs text-muted-foreground">
                          <span>{branch.totalDurationSeconds}s</span>
                          {#if branch.nodes.find((n) => n.type === 'STEP')?.cue?.targetTempC !== undefined}
                            <span class="rounded-full border border-amber-300/60 px-2 py-0.5 text-amber-700 dark:border-amber-700/40 dark:text-amber-200">
                              {branch.nodes.find((n) => n.type === 'STEP')?.cue?.targetTempC} C
                            </span>
                          {/if}
                          {#if branch.nodes.find((n) => n.type === 'STEP')?.cue?.heatLevel}
                            <span class="rounded-full border border-red-300/60 px-2 py-0.5 text-red-700 dark:border-red-700/40 dark:text-red-200">
                              {branch.nodes.find((n) => n.type === 'STEP')?.cue?.heatLevel}
                            </span>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="rounded-md border bg-background/70 p-s3">
            <Label for="rollback-reason">Rollback reason</Label>
            <Input id="rollback-reason" className="mt-s2" bind:value={rollbackReason} />
          </div>

          {#if loadError}
            <div class="rounded-md border border-red-300/60 bg-red-50 px-s3 py-s2 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-200">
              {loadError}
            </div>
          {/if}
        </div>
      {/if}
    </Card>
  </div>
</div>
