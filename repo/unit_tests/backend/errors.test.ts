import { describe, expect, it } from 'vitest';

import { AuthError } from '../../backend/src/modules/auth/auth.service';
import { normalizeError } from '../../backend/src/lib/errors';

describe('error normalization', () => {
  it('preserves auth error status and message', () => {
    const normalized = normalizeError(new AuthError('Forbidden', 403), 'test');

    expect(normalized.statusCode).toBe(403);
    expect(normalized.body.message).toBe('Forbidden');
    expect(normalized.body.code).toBe('FORBIDDEN');
  });

  it('returns generic 500 message in production for unknown errors', () => {
    const normalized = normalizeError(new Error('Sensitive internal failure'), 'production');

    expect(normalized.statusCode).toBe(500);
    expect(normalized.body.message).toBe('Internal server error');
    expect(normalized.body.code).toBe('INTERNAL_ERROR');
    expect(normalized.body.details).toBeUndefined();
  });
});
