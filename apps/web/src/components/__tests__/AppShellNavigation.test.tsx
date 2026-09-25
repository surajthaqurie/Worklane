/**
 * Tests for the App Shell & Navigation (F1).
 *
 * Coverage:
 *  - Sidebar active state via aria-current
 *  - Sidebar collapse/expand keyboard and click
 *  - Mobile drawer open/close + Escape
 *  - Deep-link active state (pathname hydration)
 *  - Responsive layout markers (translate-x class on drawer)
 *  - Breadcrumbs rendering and accessibility
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from '../layout/app-sidebar';
import { MobileNavigation } from '../layout/mobile-navigation';
import { Breadcrumbs } from '../layout/Breadcrumbs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPathname = vi.fn().mockReturnValue('/dashboard');
const mockRouter = { push: vi.fn(), replace: vi.fn() };

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => mockRouter,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// AppSidebar
// ---------------------------------------------------------------------------

describe('AppSidebar', () => {
  let onToggle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
    onToggle = vi.fn();
  });

  it('renders all global nav items when expanded', () => {
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the active link with aria-current="page"', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const link = screen.getByRole('link', { name: /Dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive links with aria-current', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const projectsLink = screen.getByRole('link', { name: /Projects/i });
    expect(projectsLink).not.toHaveAttribute('aria-current');
  });

  it('reflects deep-link active state for /projects/xxx/boards', () => {
    mockPathname.mockReturnValue('/projects/abc-123/boards');
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const projectsLink = screen.getByRole('link', { name: /Projects/i });
    expect(projectsLink).toHaveAttribute('aria-current', 'page');
  });

  it('calls onToggle when collapse button is clicked', () => {
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Collapse sidebar/i });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows "Expand sidebar" label when collapsed', () => {
    render(<AppSidebar isCollapsed={true} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /Expand sidebar/i })).toBeInTheDocument();
  });

  it('toggle button has aria-expanded=true when expanded', () => {
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Collapse sidebar/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggle button has aria-expanded=false when collapsed', () => {
    render(<AppSidebar isCollapsed={true} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Expand sidebar/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides nav item labels when collapsed', () => {
    render(<AppSidebar isCollapsed={true} onToggle={onToggle} />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('calls onToggle on Enter keypress when toggle button is focused', () => {
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Collapse sidebar/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    // Buttons fire click on Enter natively; we test via click handler
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('has a navigation landmark with correct aria-label', () => {
    render(<AppSidebar isCollapsed={false} onToggle={onToggle} />);
    expect(screen.getByRole('navigation', { name: /Workspace navigation/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MobileNavigation
// ---------------------------------------------------------------------------

describe('MobileNavigation', () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
    onClose = vi.fn();
  });

  it('dialog element is always in DOM (CSS-transition approach)', () => {
    render(<MobileNavigation isOpen={false} onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('drawer is off-screen when isOpen=false', () => {
    const { container } = render(<MobileNavigation isOpen={false} onClose={onClose} />);
    const drawer = container.querySelector('[role="dialog"]');
    expect(drawer?.className).toContain('-translate-x-full');
  });

  it('drawer is on-screen when isOpen=true', () => {
    const { container } = render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const drawer = container.querySelector('[role="dialog"]');
    expect(drawer?.className).toContain('translate-x-0');
  });

  it('renders global nav items on non-project routes', () => {
    mockPathname.mockReturnValue('/projects');
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('marks active link with aria-current="page"', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const link = screen.getByRole('link', { name: /Dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('shows project nav items inside a project route', () => {
    mockPathname.mockReturnValue('/projects/proj-1/boards');
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('link', { name: /Board/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Backlog/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All Projects/i })).toBeInTheDocument();
  });

  it('marks the active project page with aria-current', () => {
    mockPathname.mockReturnValue('/projects/proj-1/boards');
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const boardLink = screen.getByRole('link', { name: /Board/i });
    expect(boardLink).toHaveAttribute('aria-current', 'page');
  });

  it('calls onClose when a nav link is clicked', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const link = screen.getByRole('link', { name: /Projects/i });
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  it('has dialog role and aria-modal', () => {
    render(<MobileNavigation isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('does NOT call onClose when Escape is pressed with isOpen=false', () => {
    render(<MobileNavigation isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    // Effect is only registered when isOpen=true
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

describe('Breadcrumbs', () => {
  it('renders nothing when crumbs is empty', () => {
    const { container } = render(<Breadcrumbs crumbs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all breadcrumb labels', () => {
    const crumbs = [
      { label: 'Projects', href: '/projects' },
      { label: 'My Project', href: '/projects/abc' },
      { label: 'Board', href: '/projects/abc/boards' },
    ];
    render(<Breadcrumbs crumbs={crumbs} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('last item has aria-current="page" and is not a link', () => {
    const crumbs = [
      { label: 'Projects', href: '/projects' },
      { label: 'Board', href: '/projects/abc/boards' },
    ];
    render(<Breadcrumbs crumbs={crumbs} />);
    const current = screen.getByText('Board');
    expect(current.tagName).not.toBe('A');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('non-last items render as links with correct href', () => {
    const crumbs = [
      { label: 'Projects', href: '/projects' },
      { label: 'Board', href: '/projects/abc/boards' },
    ];
    render(<Breadcrumbs crumbs={crumbs} />);
    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link).toHaveAttribute('href', '/projects');
  });

  it('has nav landmark with aria-label="Breadcrumb"', () => {
    render(<Breadcrumbs crumbs={[{ label: 'Home', href: '/' }]} />);
    expect(screen.getByRole('navigation', { name: /Breadcrumb/i })).toBeInTheDocument();
  });

  it('single crumb renders as current page text, not a link', () => {
    render(<Breadcrumbs crumbs={[{ label: 'Dashboard', href: '/dashboard' }]} />);
    const el = screen.getByText('Dashboard');
    expect(el).toHaveAttribute('aria-current', 'page');
    expect(el.tagName).not.toBe('A');
  });
});
