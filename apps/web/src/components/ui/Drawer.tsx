'use client';

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { IconButton } from './IconButton';

export type DrawerPosition = 'right' | 'left' | 'bottom';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  position?: DrawerPosition;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'w-full md:w-[680px]',
  position = 'right',
}: DrawerProps) {
  const titleId = useId();
  const descId = useId();
  const drawerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles: Record<DrawerPosition, string> = {
    right: `inset-y-0 right-0 border-l ${widthClass} animate-in slide-in-from-right duration-200`,
    left: `inset-y-0 left-0 border-r ${widthClass} animate-in slide-in-from-left duration-200`,
    bottom: `inset-x-0 bottom-0 border-t max-h-[85vh] animate-in slide-in-from-bottom duration-200`,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer surface */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? descId : undefined}
        className={`
          fixed ${positionStyles[position]}
          bg-[var(--bg-surface)] shadow-2xl flex flex-col border-[var(--border-subtle)]
        `}
      >
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
          <div className="min-w-0 flex-1 pr-4">
            {title && (
              <h2
                id={titleId}
                className="text-[17px] font-semibold text-[var(--text-primary)] truncate"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p id={descId} className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <IconButton
            icon={<X className="w-4 h-4" />}
            aria-label="Close drawer"
            size="sm"
            variant="ghost"
            onClick={onClose}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
          <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
