'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { breadcrumbLabels } from '@/config/navigation';

export interface Breadcrumb {
  label: string;
  href: string;
}

/**
 * Derives breadcrumbs from the current URL pathname.
 * Dynamic segments like [projectId] are resolved using the project name
 * passed as `dynamicSegments`.
 */
export function useBreadcrumbs(
  dynamicSegments?: Record<string, string>
): Breadcrumb[] {
  const pathname = usePathname();

  return useMemo(() => {
    if (!pathname) return [];

    // Strip (route-group) wrappers — Next.js already does this in the URL,
    // but be defensive for any edge cases.
    const parts = pathname.split('/').filter(Boolean);

    const crumbs: Breadcrumb[] = [];
    let accHref = '';

    for (const segment of parts) {
      accHref += `/${segment}`;

      // Dynamic segment override (e.g. projectId → project name)
      const dynamicLabel = dynamicSegments?.[segment];
      if (dynamicLabel) {
        crumbs.push({ label: dynamicLabel, href: accHref });
        continue;
      }

      // Static label override
      const staticLabel = breadcrumbLabels[segment];
      if (staticLabel) {
        crumbs.push({ label: staticLabel, href: accHref });
        continue;
      }

      // Looks like a UUID / numeric ID — skip unless we have a dynamic label
      if (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)) {
        continue;
      }

      // Fallback: capitalise the segment
      crumbs.push({
        label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        href: accHref,
      });
    }

    return crumbs;
  }, [pathname, dynamicSegments]);
}
