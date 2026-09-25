/**
 * Tests for useBreadcrumbs — verifies crumb derivation from pathname segments.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBreadcrumbs } from '../useBreadcrumbs';

const mockPathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

describe('useBreadcrumbs', () => {
  it('returns empty array for empty pathname', () => {
    mockPathname.mockReturnValue('');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([]);
  });

  it('returns a single breadcrumb for /dashboard', () => {
    mockPathname.mockReturnValue('/dashboard');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([{ label: 'Dashboard', href: '/dashboard' }]);
  });

  it('resolves known static segment labels from breadcrumbLabels map', () => {
    mockPathname.mockReturnValue('/projects');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current[0].label).toBe('Projects');
  });

  it('skips UUID-like dynamic segments without a dynamicSegments override', () => {
    mockPathname.mockReturnValue('/projects/550e8400-e29b-41d4-a716-446655440000/boards');
    const { result } = renderHook(() => useBreadcrumbs());
    // UUID segment should be skipped; only "projects" and "boards" should appear
    expect(result.current.map((c) => c.label)).toEqual(['Projects', 'Board']);
  });

  it('uses dynamicSegments override for project id', () => {
    mockPathname.mockReturnValue('/projects/proj-abc/boards');
    const { result } = renderHook(() =>
      useBreadcrumbs({ 'proj-abc': 'Acme Project' })
    );
    const labels = result.current.map((c) => c.label);
    expect(labels).toContain('Acme Project');
    expect(labels).toContain('Board');
  });

  it('builds correct hrefs for each level', () => {
    mockPathname.mockReturnValue('/projects');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current[0].href).toBe('/projects');
  });

  it('builds correct hrefs for nested paths', () => {
    mockPathname.mockReturnValue('/projects/proj-abc/boards');
    const { result } = renderHook(() =>
      useBreadcrumbs({ 'proj-abc': 'My Project' })
    );
    const crumbs = result.current;
    expect(crumbs.find((c) => c.label === 'My Project')?.href).toBe('/projects/proj-abc');
    expect(crumbs.find((c) => c.label === 'Board')?.href).toBe('/projects/proj-abc/boards');
  });

  it('capitalises unknown segments as fallback', () => {
    mockPathname.mockReturnValue('/custom-section');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current[0].label).toBe('Custom section');
  });

  it('handles settings sub-paths', () => {
    mockPathname.mockReturnValue('/projects/abc/settings/audit-logs');
    const { result } = renderHook(() => useBreadcrumbs({ abc: 'Demo' }));
    const labels = result.current.map((c) => c.label);
    expect(labels).toContain('Settings');
    expect(labels).toContain('Audit Log');
  });
});
