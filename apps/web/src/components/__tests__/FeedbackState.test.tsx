import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { fireEvent } from '@testing-library/react';
import { FeedbackState } from '@/components/feedback/FeedbackState';

describe('FeedbackState Component', () => {
  it('renders loading state with status role and spinner', () => {
    render(<FeedbackState status="loading" title="Fetching records..." />);
    // The loading state renders an outer div[role="status"] wrapping a Spinner[role="status"],
    // so we use getAllByRole and assert at least one exists.
    const statusEls = screen.getAllByRole('status');
    expect(statusEls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Fetching records...')).toBeInTheDocument();
  });

  it('renders empty state with appropriate text', () => {
    render(
      <FeedbackState
        status="empty"
        title="No work items found"
        description="Create your first item to get started."
      />
    );
    expect(screen.getByText('No work items found')).toBeInTheDocument();
    expect(screen.getByText('Create your first item to get started.')).toBeInTheDocument();
  });

  it('renders error state with retry action', () => {
    const handleRetry = vi.fn();
    render(
      <FeedbackState
        status="error"
        error={new Error('Network timeout')}
        onRetry={handleRetry}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders permission-denied state with alert role', () => {
    render(<FeedbackState status="permission-denied" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
  });

  it('renders offline feedback state', () => {
    render(<FeedbackState status="offline" />);
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  it('renders syncing feedback state', () => {
    render(<FeedbackState status="syncing" />);
    expect(screen.getByText(/syncing changes/i)).toBeInTheDocument();
  });

  it('renders sync-failed feedback state', () => {
    render(<FeedbackState status="sync-failed" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
  });

  it('renders success feedback state', () => {
    render(<FeedbackState status="success" title="Sprint finalized" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Sprint finalized')).toBeInTheDocument();
  });
});
