import React from 'react';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  return (
    <div role="status" className="inline-flex items-center gap-2">
      <Loader2
        className={`animate-spin text-[var(--brand-primary)] ${sizeMap[size]} ${className}`}
        aria-hidden="true"
      />
      {label && <span className="text-xs text-[var(--text-secondary)]">{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center p-12 gap-3 min-h-[220px]"
    >
      <Spinner size="lg" />
      <span className="text-xs font-medium text-[var(--text-secondary)]">{message}</span>
    </div>
  );
}
