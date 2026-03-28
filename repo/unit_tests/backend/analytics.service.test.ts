import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    workflowRunEvent: {
      findMany
    }
  }
}));

import { getCompletionAccuracy } from '../../backend/src/modules/analytics/analytics.service';

describe('analytics.service getCompletionAccuracy', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('aggregates totals and percentages from workflow events', async () => {
    findMany.mockResolvedValue([
      { eventType: 'STEP_COMPLETED', createdAt: new Date('2026-03-01T10:00:00.000Z') },
      { eventType: 'STEP_COMPLETED', createdAt: new Date('2026-03-01T11:00:00.000Z') },
      { eventType: 'STEP_SKIPPED', createdAt: new Date('2026-03-01T12:00:00.000Z') },
      { eventType: 'STEP_ROLLBACK', createdAt: new Date('2026-03-02T08:00:00.000Z') }
    ]);

    const result = await getCompletionAccuracy({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-03T00:00:00.000Z'
    });

    expect(result.totals).toEqual({
      completed: 2,
      skipped: 1,
      rolledBack: 1
    });
    expect(result.percentages.completed).toBe(50);
    expect(result.percentages.skipped).toBe(25);
    expect(result.percentages.rolledBack).toBe(25);
    expect(result.dailyDrilldown).toHaveLength(2);
  });
});
