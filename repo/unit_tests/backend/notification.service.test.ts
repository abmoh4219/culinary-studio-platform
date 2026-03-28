import { describe, expect, it } from 'vitest';

import { getNotificationPreference } from '../../backend/src/modules/notifications/notification.service';

describe('notification.service getNotificationPreference authorization', () => {
  it('rejects cross-user preference access for non-admin actor', async () => {
    await expect(
      getNotificationPreference('user-1', ['MEMBER'], 'user-2')
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });
});
