import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Parses an arbitrary input (ISO string, Date object, or timestamp) into a valid Date object,
 * or returns null if invalid or missing.
 */
export function parseDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isValid(dateInput) ? dateInput : null;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isValid(d) ? d : null;
  }
  if (typeof dateInput === 'string') {
    const parsed = parseISO(dateInput);
    if (isValid(parsed)) return parsed;
    const fallback = new Date(dateInput);
    if (isValid(fallback)) return fallback;
  }
  return null;
}

/**
 * Standard date formatter. Defaults to 'MMM d, yyyy' (e.g., 'Sep 26, 2026').
 */
export function formatDate(
  dateInput: string | Date | number | null | undefined,
  formatPattern = 'MMM d, yyyy',
  fallback = '—'
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;
  return format(d, formatPattern);
}

/**
 * Formats a date with time, e.g., 'Sep 26, 2026, 11:45 AM'.
 */
export function formatDateTime(
  dateInput: string | Date | number | null | undefined,
  fallback = '—'
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;
  return format(d, 'MMM d, yyyy, h:mm a');
}

/**
 * Formats relative time, e.g., '2 hours ago'.
 */
export function formatRelativeTime(
  dateInput: string | Date | number | null | undefined,
  fallback = '—'
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;
  return `${formatDistanceToNow(d, { addSuffix: true })}`;
}

/**
 * Formats a start and end date range, e.g., 'Sep 1 – Sep 15, 2026' or 'Jan 10, 2026 – Feb 2, 2026'.
 */
export function formatDateRange(
  startDateInput?: string | Date | null,
  endDateInput?: string | Date | null,
  fallback = 'Unscheduled'
): string {
  const start = parseDate(startDateInput);
  const end = parseDate(endDateInput);

  if (!start && !end) return fallback;
  if (start && !end) return `From ${format(start, 'MMM d, yyyy')}`;
  if (!start && end) return `Until ${format(end, 'MMM d, yyyy')}`;

  if (start && end) {
    if (start.getFullYear() === end.getFullYear()) {
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
      }
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
  }

  return fallback;
}

/**
 * Converts a date input into 'YYYY-MM-DD' for HTML `<input type="date">`.
 */
export function toInputDateValue(dateInput?: string | Date | null): string {
  const d = parseDate(dateInput);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}
