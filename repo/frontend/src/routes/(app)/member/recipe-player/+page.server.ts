import { env } from '$env/dynamic/public';

import { fetchApiJson } from '$lib/server/api';

import type { PageServerLoad } from './$types';

type ActiveRunsResponse = {
  runs: Array<{
    id: string;
    recipeId: string;
    bookingId: string | null;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    currentPhaseNumber: number;
    startedAt: string | null;
    updatedAt: string;
  }>;
};

type RunStateResponse = {
  run: {
    id: string;
    recipeId: string;
    bookingId: string | null;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    currentPhaseNumber: number;
    startedAt: string | null;
    completedAt: string | null;
    steps: Array<{
      id: string;
      recipeStepId: string;
      phaseNumber: number;
      positionInPhase: number;
      titleSnapshot: string;
      durationSeconds: number | null;
      waitSeconds: number | null;
      status: 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'CANCELED' | 'FAILED';
      timerTargetAt: string | null;
      pausedRemainingSeconds: number | null;
      startedAt: string | null;
      completedAt: string | null;
    }>;
  };
  progress: {
    totalSteps: number;
    completedSteps: number;
    skippedSteps: number;
    terminalSteps: number;
    nextTimerAt: string | null;
  };
};

type TimelineResponse = {
  recipe: {
    id: string;
    name: string;
    version: number;
  };
  timeline: {
    model: string;
    totalDurationSeconds: number;
    segments: Array<{
      segmentIndex: number;
      phaseNumber: number;
      startsAtSeconds: number;
      durationSeconds: number;
      endsAtSeconds: number;
      branches: Array<{
        branchIndex: number;
        stepId: string;
        title: string;
        positionInPhase: number;
        isBlocking: boolean;
        totalDurationSeconds: number;
        nodes: Array<{
          type: 'STEP' | 'WAIT';
          label: string;
          durationSeconds: number;
          cue?: {
            text?: string;
            targetTempC?: number;
            heatLevel?: string;
          };
        }>;
      }>;
    }>;
  };
};

export const load: PageServerLoad = async (event) => {
  const apiBaseUrl = env.PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';
  const active = await fetchApiJson<ActiveRunsResponse>(event, '/workflows/runs/active');

  const requestedRunId = event.url.searchParams.get('runId');
  const selectedRunId = requestedRunId || active.runs[0]?.id || null;

  let runState: RunStateResponse | null = null;
  let timeline: TimelineResponse | null = null;
  let loadError: string | null = null;

  if (selectedRunId) {
    try {
      runState = await fetchApiJson<RunStateResponse>(event, `/workflows/runs/${encodeURIComponent(selectedRunId)}`);
      timeline = await fetchApiJson<TimelineResponse>(
        event,
        `/workflows/recipes/${encodeURIComponent(runState.run.recipeId)}/timeline`
      );
    } catch (error) {
      loadError = (error as Error).message;
    }
  }

  return {
    apiBaseUrl,
    activeRuns: active.runs,
    selectedRunId,
    runState,
    timeline,
    loadError
  };
};
