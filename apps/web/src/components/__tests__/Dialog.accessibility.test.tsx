import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { Dialog } from '@/components/ui/Dialog';

describe('Dialog Accessibility & Interaction', () => {
  it('renders with appropriate ARIA roles and attributes', () => {
    const handleClose = vi.fn();
    render(
      <Dialog
        isOpen={true}
        onClose={handleClose}
        title="Test Dialog Title"
        description="Test dialog description for screen readers."
      >
        <p>Dialog body content</p>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Test Dialog Title');
    expect(dialog).toHaveAccessibleDescription('Test dialog description for screen readers.');
  });

  it('triggers onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Content</p>
      </Dialog>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when isOpen is false', () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={false} onClose={handleClose} title="Closed Dialog">
        <p>Hidden Content</p>
      </Dialog>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
