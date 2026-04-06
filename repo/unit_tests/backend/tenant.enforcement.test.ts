import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  transaction,
  executeRaw,
  bookingFindFirst,
  bookingFindUnique,
  bookingCount,
  bookingCreate,
  bookingUpdate
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingCount: vi.fn(),
  bookingCreate: vi.fn(),
  bookingUpdate: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    booking: {
      findFirst: bookingFindFirst,
      findUnique: bookingFindUnique,
      count: bookingCount,
      create: bookingCreate,
      update: bookingUpdate
    }
  }
}));

vi.mock('../../backend/src/modules/notifications/notification.service', () => ({
  createNotification: vi.fn().mockResolvedValue({})
}));

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import {
  cancelBooking,
  previewCancellation,
  rescheduleBooking,
  scheduleBookingReminder
} from '../../backend/src/modules/bookings/booking.service';

const TENANT_A = 'tenant-aaa-aaa';
const TENANT_B = 'tenant-bbb-bbb';

describe('tenant isolation enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    transaction.mockImplementation(async (callback: any) =>
      callback({
        $executeRaw: executeRaw,
        booking: {
          findFirst: bookingFindFirst,
          findUnique: bookingFindUnique,
          count: bookingCount,
          create: bookingCreate,
          update: bookingUpdate
        },
        waitlist: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({})
        },
        userRole: {
          findMany: vi.fn().mockResolvedValue([])
        },
        workflowRun: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      })
    );
  });

  describe('cancelBooking cross-tenant rejection', () => {
    it('rejects cancellation when booking belongs to different tenant', async () => {
      // Booking exists in tenant A, but findFirst with tenant B filter returns null
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        cancelBooking({
          bookingId: 'booking-1',
          actorUserId: 'user-1',
          actorRoles: ['MEMBER'],
          capacity: 4,
          tenantId: TENANT_B
        })
      ).rejects.toMatchObject({
        message: 'Booking not found',
        statusCode: 404
      });
    });

    it('allows cancellation when booking belongs to same tenant', async () => {
      bookingFindFirst.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        resourceKey: 'session-1::seat-1',
        startAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 49 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        priceBookItemId: null
      });
      bookingUpdate.mockResolvedValue({ id: 'booking-1' });
      executeRaw.mockResolvedValue(undefined);
      bookingCount.mockResolvedValue(0);

      const result = await cancelBooking({
        bookingId: 'booking-1',
        actorUserId: 'user-1',
        actorRoles: ['MEMBER'],
        capacity: 4,
        tenantId: TENANT_A
      });

      expect(result).toBeDefined();
      // Verify findFirst was called with tenantId in where clause
      expect(bookingFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'booking-1',
            tenantId: TENANT_A
          })
        })
      );
    });
  });

  describe('previewCancellation cross-tenant rejection', () => {
    it('rejects preview when booking belongs to different tenant', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        previewCancellation({
          bookingId: 'booking-1',
          actorUserId: 'user-1',
          actorRoles: ['MEMBER'],
          tenantId: TENANT_B
        })
      ).rejects.toMatchObject({
        message: 'Booking not found',
        statusCode: 404
      });
    });
  });

  describe('rescheduleBooking cross-tenant rejection', () => {
    it('rejects reschedule when booking belongs to different tenant', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        rescheduleBooking({
          bookingId: 'booking-1',
          actorUserId: 'user-1',
          actorRoles: ['MEMBER'],
          newSessionKey: 'session-2',
          newSeatKey: 'seat-2',
          newStartAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          newEndAt: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
          capacity: 4,
          tenantId: TENANT_B
        })
      ).rejects.toMatchObject({
        message: 'Booking not found',
        statusCode: 404
      });
    });
  });

  describe('scheduleBookingReminder cross-tenant rejection', () => {
    it('rejects reminder when booking belongs to different tenant', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        scheduleBookingReminder({
          bookingId: 'booking-1',
          actorUserId: 'user-1',
          actorRoles: ['MEMBER'],
          remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          tenantId: TENANT_B
        })
      ).rejects.toMatchObject({
        message: 'Booking not found',
        statusCode: 404
      });
    });
  });

  describe('admin cannot access other tenant data', () => {
    it('admin in tenant A cannot cancel booking in tenant B', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        cancelBooking({
          bookingId: 'booking-1',
          actorUserId: 'admin-1',
          actorRoles: ['ADMIN'],
          capacity: 4,
          tenantId: TENANT_A  // admin's tenant is A
        })
      ).rejects.toMatchObject({
        message: 'Booking not found',
        statusCode: 404
      });

      // Verify the query included the tenant filter
      expect(bookingFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_A
          })
        })
      );
    });
  });

  describe('tenant-scoped query filtering', () => {
    it('findBookingWithTenant includes tenantId in where clause', async () => {
      bookingFindFirst.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        startAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        priceBookItemId: null
      });

      await previewCancellation({
        bookingId: 'booking-1',
        actorUserId: 'user-1',
        actorRoles: ['MEMBER'],
        tenantId: TENANT_A
      }).catch(() => {});

      const callArgs = bookingFindFirst.mock.calls[0];
      expect(callArgs[0].where).toHaveProperty('tenantId', TENANT_A);
    });

    it('omits tenantId from query when not provided (backwards compat)', async () => {
      bookingFindFirst.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        startAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: 'CONFIRMED',
        priceBookItemId: null
      });

      await previewCancellation({
        bookingId: 'booking-1',
        actorUserId: 'user-1',
        actorRoles: ['MEMBER']
      }).catch(() => {});

      const callArgs = bookingFindFirst.mock.calls[0];
      expect(callArgs[0].where).not.toHaveProperty('tenantId');
    });
  });
});
