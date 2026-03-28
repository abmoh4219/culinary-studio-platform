import { beforeEach, describe, expect, it, vi } from 'vitest';

const { count } = vi.hoisted(() => ({
  count: vi.fn()
}));

vi.mock('../../backend/src/lib/prisma', () => ({
  prisma: {
    booking: {
      count
    }
  }
}));

import { getBookingAvailability } from '../../backend/src/modules/bookings/booking.service';

describe('booking.service getBookingAvailability', () => {
  beforeEach(() => {
    count.mockReset();
  });

  it('returns remaining capacity and booking-open status', async () => {
    count.mockResolvedValue(3);

    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const endAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    const result = await getBookingAvailability({
      sessionKey: 'group.class.knife-techniques',
      startAt,
      endAt,
      capacity: 10,
      userRoles: ['MEMBER']
    });

    expect(result.capacity).toBe(10);
    expect(result.activeBookings).toBe(3);
    expect(result.remainingCapacity).toBe(7);
    expect(typeof result.isBookableNow).toBe('boolean');
  });
});
