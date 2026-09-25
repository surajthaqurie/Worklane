'use client';

import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  status?: AvatarStatus;
  alt?: string;
}

const sizeClasses: Record<AvatarSize, { box: string; text: string; dot: string }> = {
  xs: { box: 'w-5 h-5', text: 'text-[9px]', dot: 'w-1.5 h-1.5 ring-1' },
  sm: { box: 'w-6 h-6', text: 'text-[10px]', dot: 'w-2 h-2 ring-1' },
  md: { box: 'w-8 h-8', text: 'text-[12px]', dot: 'w-2.5 h-2.5 ring-2' },
  lg: { box: 'w-10 h-10', text: 'text-[14px]', dot: 'w-3 h-3 ring-2' },
  xl: { box: 'w-12 h-12', text: 'text-[16px]', dot: 'w-3.5 h-3.5 ring-2' },
};

const statusClasses: Record<AvatarStatus, string> = {
  online: 'bg-[var(--semantic-success-icon)]',
  busy: 'bg-[var(--semantic-danger-icon)]',
  away: 'bg-[var(--semantic-warning-icon)]',
  offline: 'bg-[var(--text-disabled)]',
};

const colorPalette = [
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-purple-600 text-white',
  'bg-cyan-600 text-white',
  'bg-teal-600 text-white',
];

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorIndex(name?: string | null): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % colorPalette.length;
}

export function Avatar({
  src,
  name,
  size = 'md',
  status,
  alt,
  className = '',
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);
  const colorClass = colorPalette[getColorIndex(name)];
  const sizeConfig = sizeClasses[size];
  const accessibleName = alt || name || 'User avatar';

  return (
    <div
      role="img"
      aria-label={accessibleName}
      className={`
        relative inline-flex items-center justify-center shrink-0 rounded-full font-medium select-none
        border border-[var(--border-subtle)]
        ${sizeConfig.box}
        ${src && !hasError ? 'bg-[var(--bg-surface-hover)]' : colorClass}
        ${className}
      `}
      {...props}
    >
      {src && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={accessibleName}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span className={`${sizeConfig.text} font-semibold leading-none`}>
          {initials}
        </span>
      )}

      {status && (
        <span
          className={`
            absolute bottom-0 right-0 rounded-full ring-[var(--bg-surface)]
            ${sizeConfig.dot}
            ${statusClasses[status]}
          `}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarSize;
  children: React.ReactNode;
}

export function AvatarGroup({
  max = 4,
  size = 'sm',
  children,
  className = '',
  ...props
}: AvatarGroupProps) {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const excess = items.length - max;
  const sizeConfig = sizeClasses[size];

  return (
    <div
      className={`flex items-center -space-x-1.5 overflow-hidden ${className}`}
      {...props}
    >
      {visible}
      {excess > 0 && (
        <div
          className={`
            inline-flex items-center justify-center shrink-0 rounded-full
            bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] font-medium
            border border-[var(--border-default)] ${sizeConfig.box} ${sizeConfig.text}
          `}
        >
          +{excess}
        </div>
      )}
    </div>
  );
}
