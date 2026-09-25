import { ApiError } from '../types/api';

export type AuthStatus =
  | 'loading'         // Initial — unknown whether session exists
  | 'authenticated'   // User has valid session
  | 'unauthenticated' // No session
  | 'session-expired' // Had session but it expired (couldn't refresh)
  | 'refreshing';     // Access token is being refreshed

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  created_at?: string;
}

export type AuthErrorKind =
  | 'invalid-credentials'
  | 'network-failure'
  | 'server-error'
  | 'session-expired'
  | 'forbidden';

export function classifyAuthError(err: unknown): AuthErrorKind {
  if (err instanceof ApiError) {
    if (err.statusCode === 401) return 'invalid-credentials';
    if (err.statusCode === 403) return 'forbidden';
    if (err.statusCode >= 500) return 'server-error';
  }
  if (err instanceof TypeError) return 'network-failure';
  return 'server-error';
}

export function authErrorMessage(kind: AuthErrorKind): string {
  switch (kind) {
    case 'invalid-credentials':
      return 'Invalid email or password. Please try again.';
    case 'network-failure':
      return 'Unable to reach the server. Check your internet connection and try again.';
    case 'server-error':
      return 'An unexpected server error occurred. Please try again later.';
    case 'session-expired':
      return 'Your session has expired. Please sign in again.';
    case 'forbidden':
      return 'You do not have permission to perform this action.';
  }
}
