import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    workflowRun: {
      findMany
    }
  }
}));

import { getActiveWorkflowRuns } from '../../backend/src/modules/workflows/workflow-run.service';

describe('workflow-run.service getActiveWorkflowRuns', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('queries runs for current operator when non-admin', async () => {
    findMany.mockResolvedValue([]);

    await getActiveWorkflowRuns('user-1', ['INSTRUCTOR']);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where.operatorUserId).toBe('user-1');
  });

  it('queries all active runs for admin', async () => {
    findMany.mockResolvedValue([]);

    await getActiveWorkflowRuns('admin-1', ['ADMIN']);

    const args = findMany.mock.calls[0][0];
    expect(args.where.operatorUserId).toBeUndefined();
    expect(args.where.status.in).toContain('RUNNING');
    expect(args.where.status.in).toContain('PAUSED');
  });
});
