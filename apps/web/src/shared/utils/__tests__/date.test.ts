import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDateRange,
  toInputDateValue,
} from '../date';

describe('date utilities', () => {
  it('parses valid ISO string and Date objects', () => {
    const iso = '2026-09-26T10:00:00.000Z';
    const date = parseDate(iso);
    expect(date).toBeInstanceOf(Date);
    expect(parseDate(null)).toBeNull();
    expect(parseDate('invalid-date')).toBeNull();
  });

  it('formats dates consistently', () => {
    const iso = '2026-09-26T10:00:00.000Z';
    expect(formatDate(iso)).toMatch(/Sep 26, 2026/);
    expect(formatDate(null)).toBe('—');
  });

  it('formats date and time', () => {
    const iso = '2026-09-26T10:30:00.000Z';
    expect(formatDateTime(iso)).toContain('Sep 26, 2026');
    expect(formatRelativeTime(iso)).toBeDefined();
  });

  it('formats date ranges', () => {
    expect(formatDateRange('2026-09-01', '2026-09-15')).toBe('Sep 1 – 15, 2026');
    expect(formatDateRange('2026-09-01', '2026-10-15')).toBe('Sep 1 – Oct 15, 2026');
    expect(formatDateRange(null, null)).toBe('Unscheduled');
  });

  it('converts to HTML input date string', () => {
    expect(toInputDateValue('2026-09-26T10:00:00.000Z')).toBe('2026-09-26');
    expect(toInputDateValue(null)).toBe('');
  });
});
