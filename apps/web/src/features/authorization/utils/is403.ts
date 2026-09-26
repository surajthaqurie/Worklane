import { ApiError } from '@/shared/types/api';

/** Returns true when the error is an HTTP 403 Forbidden response from the API. */
export function is403(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403;
}

/** Returns true when the error is an HTTP 404 Not Found response from the API. */
export function is404(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

/** Returns true for any API error with a given status code. */
export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.statusCode === status;
}
