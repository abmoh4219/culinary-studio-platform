<script lang="ts">
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  import type { PageData } from './$types';

  export let data: PageData;

  let from = data.filters.from;
  let to = data.filters.to;
  let userId = data.filters.userId;
  let limit = data.filters.limit;

  function maxOrOne(values: number[]): number {
    if (values.length === 0) return 1;
    return Math.max(...values, 1);
  }

  function pct(value: number, max: number): number {
    return Math.round((value / max) * 100);
  }

  $: viewVolume = data.viewVolume as { topRecipes?: Array<{ recipeName: string; views: number; recipeCode: string }> } | null;
  $: cuisineInterest = data.cuisineInterest as { distribution?: Array<{ cuisineTag: string; weightedViews: number; percentage: number }> } | null;
  $: weeklyStreaks = data.weeklyStreaks as { weeklyDrilldown?: Array<{ weekStartUtc: string; hasCompletion: boolean }> } | null;
  $: difficultyProgression = data.difficultyProgression as {
    dailyDrilldown?: Array<{
      day: string;
      averageDifficultyScore: number;
      completedRuns: number;
      primaryDifficulty: string | null;
    }>;
  } | null;
  $: completionAccuracy = data.completionAccuracy as {
    dailyDrilldown?: Array<{
      day: string;
      completed: number;
      skipped: number;
      rolledBack: number;
      percentages: { completed: number; skipped: number; rolledBack: number };
    }>;
  } | null;

  $: topRecipes = (viewVolume?.topRecipes ?? []) as Array<{ recipeName: string; views: number; recipeCode: string }>;
  $: cuisineDistribution = (cuisineInterest?.distribution ?? []) as Array<{ cuisineTag: string; weightedViews: number; percentage: number }>;
  $: weeklySeries = (weeklyStreaks?.weeklyDrilldown ?? []) as Array<{ weekStartUtc: string; hasCompletion: boolean }>;
  $: difficultyDaily = (difficultyProgression?.dailyDrilldown ?? []) as Array<{
    day: string;
    averageDifficultyScore: number;
    completedRuns: number;
    primaryDifficulty: string | null;
  }>;
  $: completionDaily = (completionAccuracy?.dailyDrilldown ?? []) as Array<{
    day: string;
    completed: number;
    skipped: number;
    rolledBack: number;
    percentages: { completed: number; skipped: number; rolledBack: number };
  }>;

  $: recipeMax = maxOrOne(topRecipes.map((item) => item.views));
  $: cuisineMax = maxOrOne(cuisineDistribution.map((item) => item.weightedViews));
  $: difficultyMax = maxOrOne(difficultyDaily.map((item) => item.averageDifficultyScore));
</script>

<div class="space-y-s6 pb-s12">
  <div class="flex items-center justify-between gap-s3">
    <a href="/" class="inline-flex items-center gap-s2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      ← Back to shell
    </a>
    <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Analytics Dashboard</p>
  </div>

  <Card className="p-s6 md:p-s8">
    <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Operational Analytics</h1>
    <p class="mt-s2 max-w-4xl text-sm text-muted-foreground md:text-base">
      Live charts and drill-down views powered by backend analytics APIs, with permissioned CSV exports wired to server endpoints.
    </p>

    <form method="GET" class="mt-s5 grid gap-s3 md:grid-cols-2 xl:grid-cols-4">
      <div class="space-y-s2">
        <Label for="from">From (ISO)</Label>
        <Input id="from" name="from" bind:value={from} placeholder="2026-03-01T00:00:00.000Z" />
      </div>
      <div class="space-y-s2">
        <Label for="to">To (ISO)</Label>
        <Input id="to" name="to" bind:value={to} placeholder="2026-03-30T00:00:00.000Z" />
      </div>
      <div class="space-y-s2">
        <Label for="user-id">User ID (workflow drill-down)</Label>
        <Input id="user-id" name="userId" bind:value={userId} />
      </div>
      <div class="space-y-s2">
        <Label for="limit">Top limit</Label>
        <Input id="limit" name="limit" bind:value={limit} />
      </div>
      <div class="xl:col-span-4">
        <button
          class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          type="submit"
        >
          Apply filters
        </button>
      </div>
    </form>

    <div class="mt-s5 flex flex-wrap gap-s2">
      {#each data.datasetExports as item}
        <a
          href={item.href}
          class="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </Card>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Top Recipe View Volume</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Top recipes by views in selected range.</p>

      {#if topRecipes.length === 0}
        <p class="mt-s4 text-sm text-muted-foreground">No data in current range.</p>
      {:else}
        <div class="mt-s4 space-y-s3">
          {#each topRecipes as row}
            <div>
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium">{row.recipeName}</span>
                <span class="text-muted-foreground">{row.views}</span>
              </div>
              <div class="mt-1 h-2 rounded bg-muted">
                <div class="h-2 rounded bg-primary" style={`width:${pct(row.views, recipeMax)}%`}></div>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">{row.recipeCode}</p>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Cuisine Interest Distribution</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Weighted distribution by cuisine tags.</p>

      {#if cuisineDistribution.length === 0}
        <p class="mt-s4 text-sm text-muted-foreground">No data in current range.</p>
      {:else}
        <div class="mt-s4 space-y-s3">
          {#each cuisineDistribution as row}
            <div>
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium capitalize">{row.cuisineTag}</span>
                <span class="text-muted-foreground">{row.percentage.toFixed(2)}%</span>
              </div>
              <div class="mt-1 h-2 rounded bg-muted">
                <div class="h-2 rounded bg-primary" style={`width:${pct(row.weightedViews, cuisineMax)}%`}></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  </div>

  <div class="grid gap-s4 xl:grid-cols-[1fr_1fr]">
    <Card className="p-s5">
      <h2 class="text-base font-semibold">Weekly Consistency Streaks</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Completed-run presence by UTC week.</p>

      {#if weeklySeries.length === 0}
        <p class="mt-s4 text-sm text-muted-foreground">No weekly points in selected range.</p>
      {:else}
        <div class="mt-s4 grid grid-cols-6 gap-2 md:grid-cols-8 xl:grid-cols-10">
          {#each weeklySeries as week}
            <div
              title={`${week.weekStartUtc} - ${week.hasCompletion ? 'active' : 'inactive'}`}
              class={`h-8 rounded ${week.hasCompletion ? 'bg-emerald-500/70' : 'bg-muted'}`}
            ></div>
          {/each}
        </div>
        <p class="mt-s3 text-xs text-muted-foreground">Green blocks represent weeks with at least one completed workflow run.</p>
      {/if}
    </Card>

    <Card className="p-s5">
      <h2 class="text-base font-semibold">Difficulty Progression</h2>
      <p class="mt-s1 text-sm text-muted-foreground">Daily average difficulty score (1-4 scale).</p>

      {#if difficultyDaily.length === 0}
        <p class="mt-s4 text-sm text-muted-foreground">No progression points in selected range.</p>
      {:else}
        <div class="mt-s4 space-y-s3">
          {#each difficultyDaily as day}
            <div>
              <div class="flex items-center justify-between text-sm">
                <span>{day.day}</span>
                <span class="text-muted-foreground">{day.averageDifficultyScore.toFixed(2)} ({day.primaryDifficulty ?? '-'})</span>
              </div>
              <div class="mt-1 h-2 rounded bg-muted">
                <div class="h-2 rounded bg-primary" style={`width:${pct(day.averageDifficultyScore, difficultyMax)}%`}></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  </div>

  <Card className="p-s5">
    <h2 class="text-base font-semibold">Completion Accuracy Drill-down</h2>
    <p class="mt-s1 text-sm text-muted-foreground">Daily completed/skipped/rollback proportions from workflow event stream.</p>

    {#if completionDaily.length === 0}
      <p class="mt-s4 text-sm text-muted-foreground">No completion events in selected range.</p>
    {:else}
      <div class="mt-s4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th class="py-2">Day</th>
              <th class="py-2">Completed</th>
              <th class="py-2">Skipped</th>
              <th class="py-2">Rollback</th>
              <th class="py-2">Ratios</th>
            </tr>
          </thead>
          <tbody>
            {#each completionDaily as day}
              <tr class="border-t">
                <td class="py-2 font-medium">{day.day}</td>
                <td class="py-2">{day.completed}</td>
                <td class="py-2">{day.skipped}</td>
                <td class="py-2">{day.rolledBack}</td>
                <td class="py-2 text-muted-foreground">
                  C {day.percentages.completed.toFixed(2)}% · S {day.percentages.skipped.toFixed(2)}% · R {day.percentages.rolledBack.toFixed(2)}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>
