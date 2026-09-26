/**
 * Central system constants for the Worklane API application.
 * Follows senior developer best practices for single-source-of-truth configuration.
 */

export const API_PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const HTTP_HEADER_KEYS = {
  REQUEST_ID: 'x-request-id',
  ORGANIZATION_ID: 'x-organization-id',
  IDEMPOTENCY_KEY: 'x-idempotency-key',
  AUTHORIZATION: 'authorization',
} as const;

export const SECURITY_CONSTANTS = {
  BCRYPT_SALT_ROUNDS: 10,
  DEFAULT_TOKEN_EXPIRATION: '15m',
  REFRESH_TOKEN_EXPIRATION: '7d',
} as const;

export const WORKFLOW_LIMITS = {
  MAX_TITLE_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 50000,
  MAX_TAGS_PER_ITEM: 20,
  MAX_CHILDREN_PER_ITEM: 100,
  MAX_BATCH_SIZE: 500,
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
} as const;
