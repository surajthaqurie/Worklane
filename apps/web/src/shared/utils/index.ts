/**
 * Central utility barrel & general helper functions for the Worklane Web Application.
 */

export * from './apiClient';
export * from './authEventBus';
export * from './authTokens';
export * from './date';
export * from './error';
export * from './hierarchy';

/**
 * Truncates text to maximum specified length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Formats a number with comma separators (e.g. 1,000).
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Groups an array of objects by a given key accessor.
 */
export function groupByKey<T>(array: T[], keyGetter: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyGetter(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Normalizes text to lower-case url slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Combines conditional classnames safely into a space-separated string.
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
