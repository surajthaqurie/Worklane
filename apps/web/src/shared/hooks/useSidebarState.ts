'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'worklane:sidebar:collapsed';

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Persists the sidebar collapsed state in localStorage so it survives
 * browser refreshes and deep-link navigation.
 */
export function useSidebarState() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCollapsed = useCallback((value: boolean) => {
    try {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, 'true');
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
    window.dispatchEvent(new Event('storage'));
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!getSnapshot());
  }, [setCollapsed]);

  return { isCollapsed, setCollapsed, toggle };
}
