'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export type ConfirmationVariant = 'danger' | 'warning' | 'primary';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationDialogProps) {
  const defaultConfirmText =
    confirmText || (variant === 'danger' ? 'Delete' : 'Confirm');

  const variantIcons: Record<ConfirmationVariant, React.ReactNode> = {
    danger: <AlertCircle className="w-5 h-5 text-[var(--semantic-danger-icon)]" />,
    warning: <AlertTriangle className="w-5 h-5 text-[var(--semantic-warning-icon)]" />,
    primary: <Info className="w-5 h-5 text-[var(--brand-primary)]" />,
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      role="alertdialog"
      maxWidthClass="max-w-md"
      title={
        <div className="flex items-center gap-2">
          {variantIcons[variant]}
          <span>{title}</span>
        </div>
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            isLoading={isLoading}
            onClick={handleConfirm}
          >
            {defaultConfirmText}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        {description}
      </div>
    </Dialog>
  );
}
