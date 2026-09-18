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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
    } catch (err) {
      // If /auth/me fails even after refresh attempt
      authTokens.clearAuthData();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load check stored user first for faster render
    const cachedUser = authTokens.getUser();
    if (cachedUser) {
      setUser(cachedUser);
    }
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const data = await apiClient.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { email, password });

    authTokens.setAuthData(data.accessToken, data.refreshToken, data.user);
    setUser(data.user);
    router.push('/projects');
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiClient.post<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', { name, email, password });

    authTokens.setAuthData(data.accessToken, data.refreshToken, data.user);
    setUser(data.user);
    router.push('/projects');
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
