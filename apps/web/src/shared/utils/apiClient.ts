import { ApiError } from '../types/api';
import { authTokens, User } from './authTokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEFAULT_USER_ID = '11111111-1111-1111-1111-111111111111';

let refreshingPromise: Promise<{ accessToken: string; refreshToken: string; user?: User } | null> | null = null;

async function refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string; user?: User } | null> {
  const refreshToken = authTokens.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      authTokens.clearAuthData();
      return null;
    }

    const data = await res.json();
    authTokens.setAuthData(data.accessToken, data.refreshToken, data.user);
    return data;
  } catch {
    authTokens.clearAuthData();
    return null;
  }
}

export interface CustomRequestInit extends RequestInit {
  _isRetry?: boolean;
}

export async function request<T = unknown>(
  path: string,
  options: CustomRequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});

  const accessToken = authTokens.getAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const currentUser = authTokens.getUser();
  if (!headers.has('x-user-id')) {
    headers.set('x-user-id', currentUser?.id || DEFAULT_USER_ID);
  }

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !options._isRetry && !path.includes('/auth/')) {
    if (!refreshingPromise) {
      refreshingPromise = refreshAccessToken().finally(() => {
        refreshingPromise = null;
      });
    }

    const refreshResult = await refreshingPromise;
    if (refreshResult?.accessToken) {
      return request<T>(path, {
        ...options,
        _isRetry: true,
      });
    } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.replace(new URL('/login', window.location.origin).toString());
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let details: unknown = null;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.message || errorJson.error || errorMessage;
      details = errorJson;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new ApiError(errorMessage, response.status, details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, options?: CustomRequestInit) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: CustomRequestInit) => request<T>(path, { ...options, method: 'DELETE' }),
};
