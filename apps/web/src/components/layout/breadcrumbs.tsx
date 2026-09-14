'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const pathname = usePathname();
  
  // Split pathname into segments
  const segments = pathname.split('/').filter(Boolean);
  
  if (segments.length === 0) return null;

  return (
    <nav className="flex px-4 py-3 sm:px-6 lg:px-8 border-b border-gray-200 bg-white" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-4">
        <li>
          <div>
            <Link href="/" className="text-gray-400 hover:text-gray-500">
              <Home className="flex-shrink-0 w-5 h-5" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

          return (
            <li key={segment}>
              <div className="flex items-center">
                <ChevronRight className="flex-shrink-0 w-5 h-5 text-gray-400" aria-hidden="true" />
                <Link
                  href={href}
                  className={`ml-4 text-sm font-medium ${
                    isLast ? 'text-gray-700 pointer-events-none' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {label}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
