import { describe, expect, it } from 'vitest';

import { issueInvoice } from '../../backend/src/modules/billing/billing.service';

describe('billing.service issueInvoice validation', () => {
  it('rejects invoice without lines', async () => {
    await expect(
      issueInvoice({
        actorUserId: 'user-1',
        actorRoles: ['MEMBER'],
        lines: []
      } as any)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('rejects admin-level discount for non-admin user', async () => {
    await expect(
      issueInvoice({
        actorUserId: 'user-1',
        actorRoles: ['MEMBER'],
        discountPercent: 40,
        discountReason: 'manual override',
        lines: [
          {
            type: 'MEMBERSHIP_PLAN',
            membershipPlanId: 'plan-1',
            quantity: 1
          }
        ]
      } as any)
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('rejects admin override discounts above 30% without detailed reason', async () => {
    await expect(
      issueInvoice({
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
        discountPercent: 31,
        discountReason: 'short',
        lines: [
          {
            type: 'MEMBERSHIP_PLAN',
            membershipPlanId: 'plan-1',
            quantity: 1
          }
        ]
      } as any)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });
});
