import { APIRequestContext } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';

export const OWNER_ID = process.env.E2E_OWNER_ID || 'e2e00000-0000-4000-8000-000000000001';
export const OWNER_NAME = 'E2E Owner';
export const OWNER_EMAIL = 'e2e.owner@worklane.test';

export const MEMBER_ID = process.env.E2E_MEMBER_ID || 'e2e00000-0000-4000-8000-000000000002';
export const MEMBER_NAME = 'E2E Member';
export const MEMBER_EMAIL = 'e2e.member@worklane.test';

export interface Api {
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  get<T = unknown>(path: string): Promise<T>;
}

export function apiRequest(request: APIRequestContext, userId: string): Api {
  const headers = {
    'x-user-id': userId,
    'Content-Type': 'application/json',
  };

  async function handle<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const response = await request[method.toLowerCase() as 'get' | 'post'](
      `${API_URL}${path}`,
      method === 'POST' ? { headers, data: body ?? {} } : { headers },
    );
    if (!response.ok()) {
      throw new Error(`API ${method} ${path} -> ${response.status()}: ${await response.text()}`);
    }
    if (response.status() === 204) return {} as T;
    return (await response.json()) as T;
  }

  return {
    get: <T = unknown>(path: string): Promise<T> => handle<T>('GET', path),
    post: <T = unknown>(path: string, body?: unknown): Promise<T> => handle<T>('POST', path, body),
  };
}

export function uniqueKey(prefix: string): string {
  const suffix = Date.now().toString().slice(-6);
  return `${prefix}${suffix}`.toUpperCase();
}