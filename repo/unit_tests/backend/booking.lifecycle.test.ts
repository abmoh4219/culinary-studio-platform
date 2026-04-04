import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../backend/prisma/generated';

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCount: vi.fn(),
  bookingCreate: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  waitlistFindFirst: vi.fn(),
  waitlistAggregate: vi.fn(),
  waitlistCreate: vi.fn(),
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
          aggregate: mocks.waitlistAggregate,
          create: mocks.waitlistCreate,
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
import { prisma } from '../../backend/src/lib/prisma';
import {
  cancelBooking,
  createBooking,
  previewCancellation,
  rescheduleBooking
} from '../../backend/src/modules/bookings/booking.service';

describe('booking lifecycle critical behaviors', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    vi.restoreAllMocks();
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
    ).rejects.toMatchObject({
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

  it('applies cancellation policy boundaries at exactly 24h and exactly 2h', async () => {
    const baseNow = new Date('2026-05-01T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);

    mocks.bookingFindUnique
      .mockResolvedValueOnce({
        id: 'booking-24h',
        userId: 'member-1',
        startAt: new Date(baseNow.getTime() + 24 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        priceBookItemId: null
      })
      .mockResolvedValueOnce({
        id: 'booking-2h',
        userId: 'member-1',
        startAt: new Date(baseNow.getTime() + 2 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        priceBookItemId: null
      });

    const at24h = await previewCancellation({
      bookingId: 'booking-24h',
      actorUserId: 'member-1',
      actorRoles: ['MEMBER'],
      baseAmount: 100
    });

    const at2h = await previewCancellation({
      bookingId: 'booking-2h',
      actorUserId: 'member-1',
      actorRoles: ['MEMBER'],
      baseAmount: 100
    });

    expect(at24h.preview.policyBand).toBe('FREE');
    expect(at24h.preview.feePercent).toBe(0);
    expect(at2h.preview.policyBand).toBe('FULL');
    expect(at2h.preview.feePercent).toBe(100);
    expect(at24h.preview.generatedAt).toBe(baseNow.toISOString());
    expect(at24h.preview.hoursBeforeStart).toBe(24);

    vi.useRealTimers();
  });

  it('assigns second and third waitlist queue positions sequentially', async () => {
    const { joinWaitlist } = await import('../../backend/src/modules/bookings/booking.service');
    const startAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.bookingCount.mockResolvedValue(1);
    mocks.waitlistFindFirst.mockResolvedValue(null);
    mocks.waitlistAggregate
      .mockResolvedValueOnce({ _max: { queuePosition: 1 } })
      .mockResolvedValueOnce({ _max: { queuePosition: 2 } });
    mocks.waitlistCreate
      .mockResolvedValueOnce({ id: 'w-2', userId: 'member-2', queuePosition: 2, status: 'WAITING', createdAt: new Date() })
      .mockResolvedValueOnce({ id: 'w-3', userId: 'member-3', queuePosition: 3, status: 'WAITING', createdAt: new Date() });

    const second = await joinWaitlist({
      userId: 'member-2',
      userRoles: ['MEMBER'],
      sessionKey: 'group.class.demo',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 1
    });

    const third = await joinWaitlist({
      userId: 'member-3',
      userRoles: ['MEMBER'],
      sessionKey: 'group.class.demo',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 1
    });

    expect(second.waitlistEntry.queuePosition).toBe(2);
    expect(third.waitlistEntry.queuePosition).toBe(3);
  });

  it('retries waitlist join when first insert hits concurrent unique conflict', async () => {
    const { joinWaitlist } = await import('../../backend/src/modules/bookings/booking.service');
    const startAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    const originalTransaction = vi.mocked(prisma.$transaction);
    originalTransaction
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: 'test'
      }))
      .mockImplementationOnce(async (handler: any) => {
        const tx = {
          $executeRaw: mocks.executeRaw,
          booking: {
            count: mocks.bookingCount
          },
          waitlist: {
            findFirst: mocks.waitlistFindFirst,
            aggregate: mocks.waitlistAggregate,
            create: mocks.waitlistCreate
          }
        };

        return handler(tx);
      });

    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.bookingCount.mockResolvedValue(1);
    mocks.waitlistFindFirst.mockResolvedValue(null);
    mocks.waitlistAggregate.mockResolvedValue({ _max: { queuePosition: 0 } });
    mocks.waitlistCreate.mockResolvedValue({
      id: 'w-1',
      userId: 'member-1',
      queuePosition: 1,
      status: 'WAITING',
      createdAt: new Date()
    });

    const result = await joinWaitlist({
      userId: 'member-1',
      userRoles: ['MEMBER'],
      sessionKey: 'group.class.demo',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 1
    });

    expect(result.waitlistEntry.queuePosition).toBe(1);
    expect(originalTransaction).toHaveBeenCalledTimes(2);
  });

  it('allows reschedule at exactly 2 hours before original start time', async () => {
    const baseNow = new Date('2026-06-01T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);

    const oldStart = new Date(baseNow.getTime() + 2 * 60 * 60 * 1000);
    const oldEnd = new Date(oldStart.getTime() + 60 * 60 * 1000);
    const newStart = new Date(baseNow.getTime() + 30 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);

    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.bookingFindUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'member-1',
      status: 'CONFIRMED',
      resourceKey: 'group.class.demo::station-1',
      startAt: oldStart,
      endAt: oldEnd,
      partySize: 1,
      invoiceId: null,
      priceBookId: null,
      priceBookItemId: null
    });
    mocks.userRoleFindMany.mockResolvedValue([{ role: { code: 'MEMBER' } }]);
    mocks.bookingFindFirst.mockResolvedValue(null);
    mocks.bookingCount.mockResolvedValue(0);
    mocks.bookingUpdate.mockResolvedValue({
      id: 'booking-1',
      userId: 'member-1',
      resourceKey: 'group.class.alt::station-2',
      startAt: newStart,
      endAt: newEnd,
      status: 'CONFIRMED',
      partySize: 1,
      updatedAt: new Date(baseNow)
    });
    mocks.waitlistFindFirst.mockResolvedValue(null);

    const result = await rescheduleBooking({
      bookingId: 'booking-1',
      actorUserId: 'member-1',
      actorRoles: ['MEMBER'],
      newSessionKey: 'group.class.alt',
      newSeatKey: 'station-2',
      newStartAt: newStart.toISOString(),
      newEndAt: newEnd.toISOString(),
      capacity: 10
    });

    expect(result.booking.id).toBe('booking-1');
    expect(mocks.bookingUpdate).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
