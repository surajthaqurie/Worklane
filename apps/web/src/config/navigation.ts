import { Home, Folder, Settings, LayoutDashboard, List, Play, Users, SearchCheck, SquareKanban, Bell, CalendarRange, ChartLine, ShieldCheck } from 'lucide-react';

export const globalNavigation = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, match: '/dashboard' },
  { label: 'Projects', href: '/projects', icon: Folder, match: '/projects' },
  { label: 'Notifications', href: '/notifications', icon: Bell, match: '/notifications' },
  { label: 'Settings', href: '/settings', icon: Settings, match: '/settings' },
];

export const projectNavigation = [
  { label: 'Overview', href: '', icon: LayoutDashboard, match: '' },
  { 
    label: 'Boards', 
    href: '/boards',
    icon: SquareKanban, 
    match: '/boards',
    children: [
      { label: 'Board', href: '/boards', match: '/boards' },
      { label: 'Work Items', href: '/work-items', match: '/work-items' }
    ]
  },
  { label: 'Backlogs', href: '/backlogs', icon: List, match: '/backlogs' },
  { label: 'Sprints', href: '/sprints', icon: Play, match: '/sprints' },
  { label: 'Analytics', href: '/analytics', icon: ChartLine, match: '/analytics' },
  { label: 'Queries', href: '/queries', icon: SearchCheck, match: '/queries' },
  { label: 'Delivery Plans', href: '/delivery-plans', icon: CalendarRange, match: '/delivery-plans' },
];

export const projectSettingsNavigation = [
  { label: 'Project Settings', href: '/settings', icon: Settings, match: '/settings' },
  { label: 'Teams', href: '/settings/teams', icon: Users, match: '/settings/teams' },
  { label: 'Audit Log', href: '/settings/audit-logs', icon: ShieldCheck, match: '/settings/audit-logs' },
];
