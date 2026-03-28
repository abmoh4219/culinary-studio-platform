import { describe, expect, it, vi } from 'vitest';

import { canManageBooking } from '../../backend/src/modules/bookings/booking.service';

describe('booking authorization model', () => {
  it('allows owner, front desk, and admin', async () => {
    const client = {
      workflowRun: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    } as any;

    await expect(
      canManageBooking(client, {
        actorUserId: 'user-1',
        actorRoles: ['MEMBER'],
        bookingId: 'booking-1',
        bookingOwnerUserId: 'user-1'
      })
    ).resolves.toBe(true);

    await expect(
      canManageBooking(client, {
        actorUserId: 'desk-1',
        actorRoles: ['FRONT_DESK'],
        bookingId: 'booking-1',
        bookingOwnerUserId: 'owner-1'
      })
    ).resolves.toBe(true);

    await expect(
      canManageBooking(client, {
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
        bookingId: 'booking-1',
        bookingOwnerUserId: 'owner-1'
      })
    ).resolves.toBe(true);
  });

  it('allows instructor only when assigned to booking workflow run', async () => {
    const assignedClient = {
      workflowRun: {
        findFirst: vi.fn().mockResolvedValue({ id: 'run-1' })
      }
    } as any;

    const unassignedClient = {
      workflowRun: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    } as any;

    await expect(
      canManageBooking(assignedClient, {
        actorUserId: 'inst-1',
        actorRoles: ['INSTRUCTOR'],
        bookingId: 'booking-1',
        bookingOwnerUserId: 'owner-1'
      })
    ).resolves.toBe(true);

    await expect(
      canManageBooking(unassignedClient, {
        actorUserId: 'inst-2',
        actorRoles: ['INSTRUCTOR'],
        bookingId: 'booking-1',
        bookingOwnerUserId: 'owner-1'
      })
    ).resolves.toBe(false);
  });
});
