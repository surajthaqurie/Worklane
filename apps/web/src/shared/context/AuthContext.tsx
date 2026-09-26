'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../utils/apiClient';
import { authTokens, User } from '../utils/authTokens';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authTokens.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => !authTokens.getUser());
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    const token = authTokens.getAccessToken();
    const refreshToken = authTokens.getRefreshToken();

    if (!token && !refreshToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await apiClient.get<User>('/auth/me');
      setUser(userData);
      authTokens.setUser(userData);
    } catch {
      authTokens.clearAuthData();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state only updates after the async /auth/me request resolves
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const data = await apiClient.post<{
      user: User;
      organization?: { id: string; name: string; role: string } | null;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { email, password });

    authTokens.setAuthData(data.accessToken, data.refreshToken, data.user);
    if (data.organization?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem('worklane:active_org_id', data.organization.id);
      } catch {
        // ignore
      }
    }
    setUser(data.user);
    if (data.organization?.id) {
      router.push(`/orgs/${data.organization.id}/projects`);
    } else {
      router.push('/projects');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiClient.post<{
      user: User;
      organization?: { id: string; name: string; role: string } | null;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', { name, email, password });

    authTokens.setAuthData(data.accessToken, data.refreshToken, data.user);
    if (data.organization?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem('worklane:active_org_id', data.organization.id);
      } catch {
        // ignore
      }
    }
    setUser(data.user);
    if (data.organization?.id) {
      router.push(`/orgs/${data.organization.id}/projects`);
    } else {
      router.push('/projects');
    }
  };

  const logout = async () => {
    const refreshToken = authTokens.getRefreshToken();
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore API failure during logout
    } finally {
      authTokens.clearAuthData();
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
