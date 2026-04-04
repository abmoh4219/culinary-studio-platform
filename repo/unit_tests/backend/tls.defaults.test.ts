import { describe, expect, it } from 'vitest';

import { getAuthCookieOptions } from '../../backend/src/modules/auth/auth.constants';

describe('tls/security defaults', () => {
  it('uses strict secure cookie defaults', () => {
    const cookie = getAuthCookieOptions();

    expect(cookie.secure).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('strict');
  });
});
