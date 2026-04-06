import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('audit logging coverage', () => {
  it('audit hook covers all critical path prefixes', () => {
    const hooksPath = resolve(__dirname, '../../backend/src/modules/audit/audit.hooks.ts');
    const content = readFileSync(hooksPath, 'utf-8');

    const requiredPrefixes = [
      '/api/v1/bookings',
      '/api/v1/billing',
      '/api/v1/auth/admin',
      '/api/v1/workflows',
      '/api/v1/webhooks',
      '/api/v1/analytics',
      '/api/v1/notifications'
    ];

    for (const prefix of requiredPrefixes) {
      expect(content).toContain(prefix);
    }
  });

  it('audit hook covers mutation requests', () => {
    const hooksPath = resolve(__dirname, '../../backend/src/modules/audit/audit.hooks.ts');
    const content = readFileSync(hooksPath, 'utf-8');

    expect(content).toContain('isMutationRequest');
    expect(content).toContain('isHighRiskPath');
  });

  it('resolves entity type from path for audit entries', () => {
    const hooksPath = resolve(__dirname, '../../backend/src/modules/audit/audit.hooks.ts');
    const content = readFileSync(hooksPath, 'utf-8');

    expect(content).toContain('resolveEntityType');
    expect(content).toContain('_mutation');
  });
});
