/**
 * Tests for useSidebarState — verifies localStorage persistence and toggle behaviour.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarState } from '../useSidebarState';

const STORAGE_KEY = 'worklane:sidebar:collapsed';

describe('useSidebarState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns isCollapsed=false by default', () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(false);
  });

  it('returns isCollapsed=true when localStorage has "true"', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    // Dispatch storage event to sync the store
    window.dispatchEvent(new Event('storage'));
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(true);
  });

  it('setCollapsed(true) writes to localStorage', () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => {
      result.current.setCollapsed(true);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('setCollapsed(false) removes from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useSidebarState());
    act(() => {
      result.current.setCollapsed(false);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('toggle switches from false → true', () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(false);
    act(() => {
      result.current.toggle();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('toggle switches from true → false', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    window.dispatchEvent(new Event('storage'));
    const { result } = renderHook(() => useSidebarState());
    act(() => {
      result.current.toggle();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
