'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { globalNavigation, projectNavigation, projectSettingsNavigation } from '../../config/navigation';
import { X } from 'lucide-react';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const pathname = usePathname();
  
  const projectMatch = pathname?.match(/^\/projects\/([^\/]+)/);
  const projectId = projectMatch ? projectMatch[1] : undefined;
  
  const isActiveProject = (itemMatch: string) => {
    if (!projectId) return false;
    const basePath = `/projects/${projectId}`;
    if (itemMatch === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(`${basePath}${itemMatch}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex md:hidden">
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose} />
      
      <div className="relative flex flex-col flex-1 w-full max-w-xs pt-5 pb-4 bg-gray-900 text-white transform transition-transform duration-300">
        <div className="absolute top-0 right-0 pt-2 -mr-12">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white bg-gray-600"
          >
            <span className="sr-only">Close sidebar</span>
            <X className="w-6 h-6 text-white" aria-hidden="true" />
          </button>
        </div>
        
        <div className="flex items-center flex-shrink-0 px-4">
          <span className="font-bold text-lg">TaskForge</span>
        </div>
        
        <div className="flex-1 h-0 mt-5 overflow-y-auto">
          <nav className="px-2 space-y-1">
            {projectId && pathname !== '/projects' ? (
              <>
                <Link href="/projects" onClick={onClose} className="flex items-center px-2 py-2 mb-2 text-sm text-gray-400 hover:text-white transition-colors">
                  &larr; All Projects
                </Link>
                {projectNavigation.map((item) => {
                  if (item.children) {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="mb-2">
                        <div className="flex items-center px-2 py-2 text-base font-medium text-gray-200">
                          <Icon className="flex-shrink-0 w-6 h-6 mr-4" />
                          {item.label}
                        </div>
                        <div className="ml-10 mt-1 space-y-1">
                          {item.children.map(child => {
                            const href = `/projects/${projectId}${child.href}`;
                            const active = isActiveProject(child.match);
                            return (
                              <Link
                                key={child.label}
                                href={href}
                                onClick={onClose}
                                className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                  active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const href = `/projects/${projectId}${item.href}`;
                  const active = isActiveProject(item.match);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={href}
                      onClick={onClose}
                      className={`flex items-center px-2 py-2 text-base font-medium rounded-md ${
                        active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon className="flex-shrink-0 w-6 h-6 mr-4" />
                      {item.label}
                    </Link>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-gray-700">
                  {projectSettingsNavigation.map((item) => {
                    const href = `/projects/${projectId}${item.href}`;
                    const active = isActiveProject(item.match);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.label}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center px-2 py-2 text-base font-medium rounded-md ${
                          active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <Icon className="flex-shrink-0 w-6 h-6 mr-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              globalNavigation.map((item) => {
                const active = pathname.startsWith(item.match) && (item.match !== '/' || pathname === '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      active ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="flex-shrink-0 w-6 h-6 mr-4" />
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>
        </div>
      </div>
      
      <div className="flex-shrink-0 w-14" aria-hidden="true">
      </div>
    </div>
  );
}
