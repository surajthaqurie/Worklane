'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { projectNavigation } from '../../config/navigation';
import { ChevronDown } from 'lucide-react';

interface ProjectHeaderProps {
  projectId: string;
  projectName: string;
  projectKey?: string;
  actions?: React.ReactNode;
}

export function ProjectHeader({ projectId, projectName, projectKey = 'APP', actions }: ProjectHeaderProps) {
  const pathname = usePathname();

  const isActive = (itemMatch: string) => {
    const basePath = `/projects/${projectId}`;
    if (itemMatch === '') {
      return pathname === basePath;
    }
    return pathname.startsWith(`${basePath}${itemMatch}`);
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1 relative">
            <button className="flex items-center text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight hover:bg-gray-50 p-1 -ml-1 rounded-md transition-colors">
              {projectName}
              <ChevronDown className="ml-2 h-5 w-5 text-gray-500" />
            </button>
            <div className="mt-1 text-sm text-gray-500 font-medium">
              {projectKey}
            </div>
          </div>
          {actions && (
            <div className="mt-4 flex md:ml-4 md:mt-0">
              {actions}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {projectNavigation.map((tab) => {
            const href = `/projects/${projectId}${tab.href}`;
            const active = isActive(tab.match);
            return (
              <Link
                key={tab.label}
                href={href}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${active
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
