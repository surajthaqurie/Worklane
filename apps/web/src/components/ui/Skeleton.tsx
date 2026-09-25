'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  isCircle?: boolean;
}

export function Skeleton({
  width,
  height,
  isCircle = false,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const customStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  return (
    <div
      aria-hidden="true"
      style={customStyle}
      className={`
        animate-pulse bg-[var(--border-default)]
        ${isCircle ? 'rounded-full' : 'rounded-[var(--radius-xs)]'}
        ${className}
      `}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="12px"
          width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 36 }: { size?: number }) {
  return <Skeleton width={size} height={size} isCircle />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`p-4 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] flex flex-col gap-3 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle size={32} />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton height="14px" width="40%" />
          <Skeleton height="10px" width="20%" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] overflow-hidden bg-[var(--bg-surface)] flex flex-col divide-y divide-[var(--border-subtle)]"
      aria-hidden="true"
    >
      <div className="flex p-3 bg-[var(--bg-surface-hover)] gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="14px" className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex p-3 gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="12px" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
