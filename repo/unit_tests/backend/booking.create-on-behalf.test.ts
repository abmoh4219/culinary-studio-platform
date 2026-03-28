import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transaction, executeRaw, bookingFindFirst, bookingCount, bookingCreate } = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCount: vi.fn(),
  bookingCreate: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    $transaction: transaction
  }
}));

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import { createBooking } from '../../backend/src/modules/bookings/booking.service';

describe('booking create on behalf authorization', () => {
  beforeEach(() => {
    executeRaw.mockReset();
    bookingFindFirst.mockReset();
    bookingCount.mockReset();
    bookingCreate.mockReset();
    transaction.mockReset();

    transaction.mockImplementation(async (callback: any) =>
      callback({
        $executeRaw: executeRaw,
        booking: {
          findFirst: bookingFindFirst,
          count: bookingCount,
          create: bookingCreate
        }
      })
    );

    bookingFindFirst.mockResolvedValue(null);
    bookingCount.mockResolvedValue(0);
    bookingCreate.mockResolvedValue({
      id: 'booking-1',
      userId: 'member-2',
      resourceKey: 'session-1::seat-1',
      startAt: new Date('2026-03-10T10:00:00.000Z'),
      endAt: new Date('2026-03-10T11:00:00.000Z'),
      status: 'CONFIRMED',
      source: 'STAFF',
      partySize: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z')
    });
  });

  it('allows front desk staff to create a booking for a customer', async () => {
    const result = await createBooking({
      actorUserId: 'desk-1',
      actorRoles: ['FRONT_DESK'],
      userId: 'member-2',
      userRoles: ['FRONT_DESK'],
      sessionKey: 'session-1',
      seatKey: 'seat-1',
      startAt: '2026-03-10T10:00:00.000Z',
      endAt: '2026-03-10T11:00:00.000Z',
      capacity: 4,
      partySize: 1
    });

    expect(result.userId).toBe('member-2');
    expect(bookingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'member-2',
          createdByUserId: 'desk-1'
        })
      })
    );
  });

  it('rejects member attempts to create a booking for another user', async () => {
    await expect(
      createBooking({
        actorUserId: 'member-1',
        actorRoles: ['MEMBER'],
        userId: 'member-2',
        userRoles: ['MEMBER'],
        sessionKey: 'session-1',
        seatKey: 'seat-1',
        startAt: '2026-03-10T10:00:00.000Z',
        endAt: '2026-03-10T11:00:00.000Z',
        capacity: 4,
        partySize: 1
      })
    ).rejects.toMatchObject<AuthError>({
      statusCode: 403,
      message: 'Not allowed to create bookings for another user'
    });

    expect(transaction).not.toHaveBeenCalled();
  });
});
