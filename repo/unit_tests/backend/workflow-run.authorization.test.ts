import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bookingFindUnique,
  recipeFindUnique,
  workflowRunFindFirst,
  workflowRunFindUnique,
  transaction
} = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  recipeFindUnique: vi.fn(),
  workflowRunFindFirst: vi.fn(),
  workflowRunFindUnique: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    booking: {
      findUnique: bookingFindUnique
    },
    recipe: {
      findUnique: recipeFindUnique
    },
    workflowRun: {
      findFirst: workflowRunFindFirst,
      findUnique: workflowRunFindUnique
    },
    $transaction: transaction
  }
}));

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import { createWorkflowRun } from '../../backend/src/modules/workflows/workflow-run.service';

describe('workflow-run.service booking authorization', () => {
  beforeEach(() => {
    bookingFindUnique.mockReset();
    recipeFindUnique.mockReset();
    workflowRunFindFirst.mockReset();
    workflowRunFindUnique.mockReset();
    transaction.mockReset();
  });

  it('rejects workflow creation when actor cannot reference another user booking', async () => {
    bookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'owner-1'
    });
    workflowRunFindFirst.mockResolvedValue(null);

    await expect(
      createWorkflowRun({
        actorUserId: 'member-2',
        actorRoles: ['MEMBER'],
        recipeId: 'recipe-1',
        bookingId: 'booking-1'
      })
    ).rejects.toMatchObject<AuthError>({
      message: 'Not allowed to reference this booking',
      statusCode: 403
    });

    expect(recipeFindUnique).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows an assigned instructor to create a workflow run for the referenced booking', async () => {
    bookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'owner-1'
    });
    workflowRunFindFirst.mockResolvedValue({
      id: 'existing-run-1'
    });
    recipeFindUnique.mockResolvedValue({
      id: 'recipe-1',
      version: 3,
      steps: [
        {
          id: 'step-1',
          phaseNumber: 1,
          positionInPhase: 1,
          title: 'Prep',
          durationSeconds: 0,
          waitSeconds: 0
        }
      ]
    });

    transaction.mockImplementation(async (callback: any) => {
      const tx = {
        workflowRun: {
          create: vi.fn().mockResolvedValue({
            id: 'run-1',
            recipeId: 'recipe-1',
            bookingId: 'booking-1',
            operatorUserId: 'instructor-1',
            status: 'RUNNING',
            currentPhaseNumber: 1,
            recipeVersionSnapshot: 3,
            startedAt: new Date('2026-03-01T00:00:00.000Z'),
            createdAt: new Date('2026-03-01T00:00:00.000Z')
          }),
          update: vi.fn().mockResolvedValue(undefined),
          findUnique: vi.fn().mockResolvedValue({
            id: 'run-1',
            status: 'RUNNING'
          })
        },
        workflowRunStep: {
          create: vi.fn().mockResolvedValue(undefined),
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: 'run-step-1',
                durationSeconds: 0,
                waitSeconds: 0
              }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              {
                id: 'run-step-1',
                phaseNumber: 1,
                status: 'COMPLETED'
              }
            ]),
          update: vi.fn().mockResolvedValue(undefined)
        },
        workflowRunEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        }
      };

      return callback(tx);
    });

    workflowRunFindUnique.mockResolvedValue({
      id: 'run-1',
      recipeId: 'recipe-1',
      bookingId: 'booking-1',
      operatorUserId: 'instructor-1',
      status: 'RUNNING',
      startedAt: new Date('2026-03-01T00:00:00.000Z'),
      completedAt: null,
      scheduledStartAt: null,
      currentPhaseNumber: 1,
      recipeVersionSnapshot: 3,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      steps: [
        {
          id: 'run-step-1',
          recipeStepId: 'step-1',
          phaseNumber: 1,
          positionInPhase: 1,
          titleSnapshot: 'Prep',
          durationSeconds: 0,
          waitSeconds: 0,
          status: 'COMPLETED',
          readyAt: new Date('2026-03-01T00:00:00.000Z'),
          timerTargetAt: null,
          pausedRemainingSeconds: null,
          startedAt: new Date('2026-03-01T00:00:00.000Z'),
          completedAt: new Date('2026-03-01T00:00:00.000Z'),
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:00:00.000Z')
        }
      ]
    });

    const result = await createWorkflowRun({
      actorUserId: 'instructor-1',
      actorRoles: ['INSTRUCTOR'],
      recipeId: 'recipe-1',
      bookingId: 'booking-1'
    });

    expect(result.run.id).toBe('run-1');
    expect(bookingFindUnique).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      select: { id: true, userId: true }
    });
    expect(workflowRunFindFirst).toHaveBeenCalledTimes(1);
  });
});
