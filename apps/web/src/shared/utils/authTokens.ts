const ACCESS_TOKEN_KEY = 'worklane_access_token';
const REFRESH_TOKEN_KEY = 'worklane_refresh_token';
const USER_KEY = 'worklane_user';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  created_at?: string;
}

export const authTokens = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as User;
    } catch {
      return null;
    }
  },

  setAuthData(accessToken: string, refreshToken: string, user?: User) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  setUser(user: User) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearAuthData() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
