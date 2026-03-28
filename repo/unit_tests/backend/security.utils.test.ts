import { describe, expect, it } from 'vitest';

import { bodyHash, getRequestPath, isMutationRequest, isProtectedBusinessAction, stableJsonStringify } from '../../backend/src/modules/security/security.utils';

describe('security.utils', () => {
  it('identifies protected mutation routes', () => {
    process.env.SECURITY_ACTION_PATH_PREFIXES = '/bookings,/billing';

    const request = {
      method: 'POST',
      raw: {
        url: '/bookings?x=1'
      }
    } as any;

    expect(getRequestPath(request)).toBe('/bookings');
    expect(isMutationRequest(request)).toBe(true);
    expect(isProtectedBusinessAction(request)).toBe(true);
  });

  it('stableJsonStringify sorts object keys deterministically', () => {
    const value = {
      z: 1,
      a: {
        d: 4,
        b: 2
      }
    };

    expect(stableJsonStringify(value)).toBe('{"a":{"b":2,"d":4},"z":1}');
  });

  it('bodyHash is deterministic for equivalent objects', () => {
    const first = bodyHash({ b: 2, a: 1 });
    const second = bodyHash({ a: 1, b: 2 });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('does not protect non-mutation routes', () => {
    const request = {
      method: 'GET',
      raw: {
        url: '/bookings'
      }
    } as any;

    expect(isMutationRequest(request)).toBe(false);
    expect(isProtectedBusinessAction(request)).toBe(false);
  });
});
