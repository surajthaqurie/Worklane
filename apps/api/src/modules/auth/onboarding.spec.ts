import { describe, it, expect } from 'vitest';
import { generateDefaultOrganizationName } from './auth.service.js';

describe('Default Organization Naming & Onboarding Rules', () => {
  it('formats single and full names into default organization names safely', () => {
    expect(generateDefaultOrganizationName('Suraj Chand')).toBe("Suraj Chand's Organization");
    expect(generateDefaultOrganizationName('suraj')).toBe("suraj's Organization");
    expect(generateDefaultOrganizationName('James')).toBe("James' Organization");
    expect(generateDefaultOrganizationName('Jane Doe')).toBe("Jane Doe's Organization");
    expect(generateDefaultOrganizationName('Alex')).toBe("Alex's Organization");
  });

  it('handles empty or missing name with safe fallback', () => {
    expect(generateDefaultOrganizationName('')).toBe('Default Organization');
    expect(generateDefaultOrganizationName('   ')).toBe('Default Organization');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(generateDefaultOrganizationName(null as any)).toBe('Default Organization');
  });

  it('handles existing apostrophes safely', () => {
    expect(generateDefaultOrganizationName("O'Connor")).toBe("O'Connor's Organization");
    expect(generateDefaultOrganizationName("Suraj's")).toBe("Suraj's Organization");
  });
});
