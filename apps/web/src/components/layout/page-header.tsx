import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-subtle)]">
      <div className="min-w-0 flex-1">
        <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
