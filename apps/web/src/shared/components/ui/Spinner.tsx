import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return <Loader2 className={`animate-spin text-[var(--brand-primary)] ${sizeMap[size]} ${className}`} />;
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[200px]">
      <Spinner size="lg" />
      <span className="text-xs text-[var(--text-secondary)]">{message}</span>
    </div>
  );
}
