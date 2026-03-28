import { describe, expect, it } from 'vitest';

import { categoryMeta, getOfferingBySlug, memberOfferings } from './offerings';

describe('member offerings catalog', () => {
  it('contains all expected offering categories', () => {
    const categories = new Set(memberOfferings.map((item) => item.category));
    expect(categories.has('memberships')).toBe(true);
    expect(categories.has('group-classes')).toBe(true);
    expect(categories.has('coaching')).toBe(true);
    expect(categories.has('value-added')).toBe(true);
  });

  it('resolves offering details by slug', () => {
    const offering = getOfferingBySlug('personal-coaching-performance');
    expect(offering?.title).toContain('Personal Coaching');
  });

  it('has category metadata for each category', () => {
    expect(categoryMeta.memberships.title.length).toBeGreaterThan(0);
    expect(categoryMeta['group-classes'].description.length).toBeGreaterThan(0);
  });
});
