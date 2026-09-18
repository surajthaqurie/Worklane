'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useCallback, useLayoutEffect, useSyncExternalStore, createContext, useContext } from 'react';
import { ToastProvider } from '@/shared/components/ui/Toast';
import { AuthProvider } from '@/shared/context/AuthContext';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  setTheme: () => null,
});

const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function useThemeStore(storageKey: string, defaultTheme: Theme) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToStorage(onStoreChange),
    [],
  );

  const getSnapshot = useCallback(
    () => {
      const stored = window.localStorage.getItem(storageKey);
      return isTheme(stored) ? stored : defaultTheme;
    },
    [storageKey, defaultTheme],
  );

  const theme = useSyncExternalStore(subscribe, getSnapshot, () => defaultTheme);

  const setTheme = useCallback(
    (next: Theme) => {
      window.localStorage.setItem(storageKey, next);
      window.dispatchEvent(new Event('storage'));
    },
    [storageKey],
  );

  return { theme, setTheme };
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const { theme, setTheme } = useThemeStore(storageKey, defaultTheme);

  useLayoutEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = { theme, setTheme };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <ThemeProvider defaultTheme="system" storageKey="taskforge-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}