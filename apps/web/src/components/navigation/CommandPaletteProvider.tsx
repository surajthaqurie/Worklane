'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Folder,
  SquareKanban,
  List,
  Play,
  CalendarRange,
  ChartLine,
  SearchCheck,
  Settings,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { CommandPalette, CommandItem } from '@/components/navigation/CommandPalette';
import { useKeyboardShortcut } from '@/shared/hooks/useKeyboardShortcut';
import { usePathname } from 'next/navigation';

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

/**
 * Global command palette provider. Mount once inside the app shell.
 *
 * Opening shortcut: ⌘K / Ctrl+K
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // ⌘K / Ctrl+K
  useKeyboardShortcut('k', open, { metaOrCtrl: true, ignoreInputs: false });

  // Derive current projectId from the pathname so we can build project-scoped links
  const projectMatch = pathname?.match(/\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: 'goto-dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        icon: <LayoutDashboard className="w-4 h-4" aria-hidden />,
        shortcut: 'G D',
        keywords: ['home', 'overview'],
        onSelect: () => router.push('/dashboard'),
      },
      {
        id: 'goto-projects',
        label: 'Open Projects',
        category: 'Navigation',
        icon: <Folder className="w-4 h-4" aria-hidden />,
        shortcut: 'G P',
        keywords: ['project', 'all'],
        onSelect: () => router.push('/projects'),
      },
    ];

    // Project-scoped navigation — only shown when inside a project
    if (projectId) {
      const projectNav: CommandItem[] = [
        {
          id: 'goto-board',
          label: 'Go to Board',
          description: 'Kanban board for this project',
          category: 'Project',
          icon: <SquareKanban className="w-4 h-4" aria-hidden />,
          keywords: ['kanban', 'board', 'sprint'],
          onSelect: () => router.push(`/projects/${projectId}/boards`),
        },
        {
          id: 'goto-backlog',
          label: 'Go to Backlog',
          description: 'Product backlog',
          category: 'Project',
          icon: <List className="w-4 h-4" aria-hidden />,
          keywords: ['backlog', 'items', 'list'],
          onSelect: () => router.push(`/projects/${projectId}/backlogs`),
        },
        {
          id: 'goto-sprints',
          label: 'Go to Sprints',
          description: 'Sprint / iteration planning',
          category: 'Project',
          icon: <Play className="w-4 h-4" aria-hidden />,
          keywords: ['sprint', 'iteration'],
          onSelect: () => router.push(`/projects/${projectId}/sprints`),
        },
        {
          id: 'goto-queries',
          label: 'Go to Queries',
          description: 'Saved work-item queries',
          category: 'Project',
          icon: <SearchCheck className="w-4 h-4" aria-hidden />,
          keywords: ['query', 'search', 'filter'],
          onSelect: () => router.push(`/projects/${projectId}/queries`),
        },
        {
          id: 'goto-delivery-plans',
          label: 'Go to Delivery Plans',
          description: 'Cross-team roadmap timeline',
          category: 'Project',
          icon: <CalendarRange className="w-4 h-4" aria-hidden />,
          keywords: ['roadmap', 'delivery', 'plan', 'timeline'],
          onSelect: () => router.push(`/projects/${projectId}/delivery-plans`),
        },
        {
          id: 'goto-analytics',
          label: 'Go to Analytics',
          description: 'Charts and metrics',
          category: 'Project',
          icon: <ChartLine className="w-4 h-4" aria-hidden />,
          keywords: ['chart', 'metrics', 'analytics', 'velocity'],
          onSelect: () => router.push(`/projects/${projectId}/analytics`),
        },
        {
          id: 'goto-project-settings',
          label: 'Go to Project Settings',
          category: 'Project',
          icon: <Settings className="w-4 h-4" aria-hidden />,
          keywords: ['settings', 'config'],
          onSelect: () => router.push(`/projects/${projectId}/settings`),
        },
      ];
      nav.push(...projectNav);
    }

    const actions: CommandItem[] = [
      {
        id: 'create-work-item',
        label: 'Create Work Item',
        description: 'Open the new work item form',
        category: 'Actions',
        icon: <Plus className="w-4 h-4" aria-hidden />,
        shortcut: 'C',
        keywords: ['create', 'new', 'task', 'bug', 'story'],
        onSelect: () => {
          // Emits a custom event so any mounted CreateWorkItemModal can open
          window.dispatchEvent(new CustomEvent('worklane:create-work-item'));
        },
      },
      {
        id: 'search-work-items',
        label: 'Search Work Items',
        description: 'Full-text search across projects',
        category: 'Actions',
        icon: <SearchCheck className="w-4 h-4" aria-hidden />,
        keywords: ['search', 'find', 'work item'],
        onSelect: () => {
          // Focus the global search input
          const input = document.getElementById('search-field') as HTMLInputElement | null;
          input?.focus();
        },
      },
      {
        id: 'open-project',
        label: 'Open Project…',
        description: 'Navigate to any project',
        category: 'Actions',
        icon: <ArrowRight className="w-4 h-4" aria-hidden />,
        keywords: ['switch', 'project', 'open'],
        onSelect: () => router.push('/projects'),
      },
    ];
    nav.push(...actions);

    return nav;
  }, [projectId, router]);

  const ctx = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} items={items} />
    </CommandPaletteContext.Provider>
  );
}
