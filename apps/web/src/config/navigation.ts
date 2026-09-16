import { Home, Folder, Settings, LayoutDashboard, ListTodo, List, Play, Users, SearchCheck, LineChart, SquareKanban } from 'lucide-react';

export const globalNavigation = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, match: '/dashboard' },
  { label: 'Projects', href: '/projects', icon: Folder, match: '/projects' },
  { label: 'Settings', href: '/settings', icon: Settings, match: '/settings' },
];

export const projectNavigation = [
  { label: 'Overview', href: '', icon: LayoutDashboard, match: '' },
  { label: 'Boards', href: '/board', icon: SquareKanban, match: '/board' },
  { label: 'Work Items', href: '/work-items', icon: ListTodo, match: '/work-items' },
  { label: 'Backlog', href: '/backlog', icon: List, match: '/backlog' },
  { label: 'Sprints', href: '/sprints', icon: Play, match: '/sprints' },
  { label: 'Queries', href: '/queries', icon: SearchCheck, match: '/queries' },
  { label: 'Analytics', href: '/analytics', icon: LineChart, match: '/analytics' },
  { label: 'Members', href: '/members', icon: Users, match: '/members' },
];

export const projectSettingsNavigation = [
  { label: 'Settings', href: '/settings', icon: Settings, match: '/settings' },
];
