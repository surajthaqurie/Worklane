'use client';

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { IconButton } from './IconButton';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  role?: 'dialog' | 'alertdialog';
  showCloseButton?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-md',
  role = 'dialog',
  showCloseButton = true,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog surface */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={`
          relative w-full ${maxWidthClass} bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]
          rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-dialog)]
          overflow-hidden animate-in fade-in zoom-in-95 duration-150
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex flex-col gap-0.5 min-w-0 pr-4">
              {title && (
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold text-[var(--text-primary)] truncate"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-[12px] text-[var(--text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <IconButton
                icon={<X className="w-4 h-4" />}
                aria-label="Close dialog"
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Backward compatible alias for existing Modal imports
 */
export const Modal = Dialog;
export type ModalProps = DialogProps;
