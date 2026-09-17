import { ApiError } from '../types/api';

export function formatApiError(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage;
}
