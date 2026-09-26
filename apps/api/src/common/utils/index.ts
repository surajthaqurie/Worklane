/**
 * Central utility functions for the Worklane API application.
 * Follows senior developer best practices for safe data manipulation and pagination formatting.
 */

import { API_PAGINATION } from '../constants/index.js';
import type { PaginatedResponse, PaginationMetadata, PaginationQueryParams } from '../interfaces/index.js';

/**
 * Calculates safe pagination offset and sanitized limit.
 */
export function calculatePaginationOffset(params: PaginationQueryParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(API_PAGINATION.DEFAULT_PAGE, Number(params.page) || API_PAGINATION.DEFAULT_PAGE);
  const rawLimit = Number(params.limit) || API_PAGINATION.DEFAULT_LIMIT;
  const limit = Math.min(API_PAGINATION.MAX_LIMIT, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds standard paginated response payload.
 */
export function buildPaginatedResponse<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const meta: PaginationMetadata = {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return { items, meta };
}

/**
 * Safely omits key properties from an object.
 */
export function omitFields<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Safely picks specified properties from an object.
 */
export function pickFields<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Normalizes text to lower-case url-friendly slug.
 */
export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
