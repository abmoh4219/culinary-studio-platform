import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn utility', () => {
  it('merges conflicting tailwind classes', () => {
    const merged = cn('px-2 py-1', 'px-4', 'text-sm');
    expect(merged).toContain('px-4');
    expect(merged).not.toContain('px-2');
    expect(merged).toContain('text-sm');
  });
});
