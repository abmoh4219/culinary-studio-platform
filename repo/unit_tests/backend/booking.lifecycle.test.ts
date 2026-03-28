import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCount: vi.fn(),
  bookingCreate: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  waitlistFindFirst: vi.fn(),
  waitlistUpdate: vi.fn(),
  userRoleFindMany: vi.fn(),
  workflowRunFindFirst: vi.fn(),
  priceBookItemFindUnique: vi.fn()
}));

vi.mock('../../backend/src/modules/notifications/notification.service', () => ({
  createNotification: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (handler: any) => {
      const tx = {
        $executeRaw: mocks.executeRaw,
        booking: {
          findFirst: mocks.bookingFindFirst,
          count: mocks.bookingCount,
          create: mocks.bookingCreate,
          findUnique: mocks.bookingFindUnique,
          update: mocks.bookingUpdate
        },
        waitlist: {
          findFirst: mocks.waitlistFindFirst,
          update: mocks.waitlistUpdate
        },
        userRole: {
          findMany: mocks.userRoleFindMany
        },
        workflowRun: {
          findFirst: mocks.workflowRunFindFirst
        },
        priceBookItem: {
          findUnique: mocks.priceBookItemFindUnique
        }
      };

      return handler(tx);
    })
  }
}));

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import { cancelBooking, createBooking } from '../../backend/src/modules/bookings/booking.service';

describe('booking lifecycle critical behaviors', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || 'test_field_encryption_key_32b!!!';
  });

  it('rejects overlapping booking creation with 409 conflict', async () => {
    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.bookingFindFirst.mockResolvedValue({ id: 'existing-booking' });

    await expect(
      createBooking({
        userId: 'member-1',
        userRoles: ['MEMBER'],
        sessionKey: 'group.class.demo',
        seatKey: 'station-1',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        capacity: 10
      })
    ).rejects.toMatchObject<AuthError>({
      statusCode: 409,
      message: 'Selected seat/resource is already booked for an overlapping time'
    });
  });

  it('promotes next waitlisted user when booking is canceled and capacity opens', async () => {
    const startAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.bookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'owner-1',
      resourceKey: 'group.class.demo::station-1',
      startAt,
      endAt,
      status: 'CONFIRMED',
      priceBookItemId: null
    });
    mocks.bookingUpdate.mockResolvedValue({ id: 'booking-1' });
    mocks.waitlistFindFirst.mockResolvedValue({
      id: 'wait-1',
      userId: 'member-2',
      queuePosition: 1
    });
    mocks.userRoleFindMany.mockResolvedValue([{ role: { code: 'MEMBER' } }]);
    mocks.bookingCount.mockResolvedValue(0);
    mocks.bookingFindFirst.mockResolvedValue(null);
    mocks.bookingCreate.mockResolvedValue({
      id: 'booking-promoted',
      userId: 'member-2',
      resourceKey: 'group.class.demo::station-1',
      startAt,
      endAt,
      status: 'CONFIRMED',
      source: 'STAFF',
      partySize: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mocks.waitlistUpdate.mockResolvedValue({ id: 'wait-1' });

    const result = await cancelBooking({
      bookingId: 'booking-1',
      actorUserId: 'frontdesk-1',
      actorRoles: ['FRONT_DESK'],
      capacity: 1
    });

    expect(result.promotion?.promoted, 'Waitlist entry should be promoted after cancellation').toBe(true);
    expect(result.promotion?.booking?.id).toBe('booking-promoted');
    expect(mocks.waitlistUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wait-1' },
        data: expect.objectContaining({ status: 'CONVERTED', bookingId: 'booking-promoted' })
      })
    );
  });
});
