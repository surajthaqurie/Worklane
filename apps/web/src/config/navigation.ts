import {
  Home,
  Folder,
  Settings,
  LayoutDashboard,
  List,
  Play,
  Users,
  SearchCheck,
  SquareKanban,
  Bell,
  CalendarRange,
  ChartLine,
  ShieldCheck,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  /** Used to determine active state via `pathname.startsWith(match)` */
  match: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /** Permission required to see this item. Absence means always visible. */
  permission?: string;
  children?: NavItem[];
}

export const globalNavigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, match: '/dashboard' },
  { label: 'Projects', href: '/projects', icon: Folder, match: '/projects' },
  { label: 'Notifications', href: '/notifications', icon: Bell, match: '/notifications' },
  { label: 'Settings', href: '/settings', icon: Settings, match: '/settings' },
];

export const projectNavigation: NavItem[] = [
  { label: 'Overview', href: '', icon: LayoutDashboard, match: '' },
  { label: 'Board', href: '/boards', icon: SquareKanban, match: '/boards' },
  { label: 'Backlog', href: '/backlogs', icon: List, match: '/backlogs' },
  { label: 'Sprints', href: '/sprints', icon: Play, match: '/sprints' },
  {
    label: 'Queries',
    href: '/queries',
    icon: SearchCheck,
    match: '/queries',
    permission: 'query:view',
  },
  {
    label: 'Delivery Plans',
    href: '/delivery-plans',
    icon: CalendarRange,
    match: '/delivery-plans',
    permission: 'delivery_plan:view',
  },
  { label: 'Analytics', href: '/analytics', icon: ChartLine, match: '/analytics' },
];

export const projectSettingsNavigation: NavItem[] = [
  {
    label: 'Project Settings',
    href: '/settings',
    icon: Settings,
    match: '/settings',
    permission: 'project:manage_settings',
  },
  {
    label: 'Teams',
    href: '/settings/teams',
    icon: Users,
    match: '/settings/teams',
    permission: 'project:manage_teams',
  },
  {
    label: 'Audit Log',
    href: '/settings/audit-logs',
    icon: ShieldCheck,
    match: '/settings/audit-logs',
    permission: 'audit_log:view',
  },
];

/** Breadcrumb label overrides keyed by path segment. */
export const breadcrumbLabels: Record<string, string> = {
  projects: 'Projects',
  boards: 'Board',
  backlogs: 'Backlog',
  sprints: 'Sprints',
  queries: 'Queries',
  'delivery-plans': 'Delivery Plans',
  analytics: 'Analytics',
  settings: 'Settings',
  teams: 'Teams',
  'audit-logs': 'Audit Log',
  dashboard: 'Dashboard',
  notifications: 'Notifications',
  orgs: 'Organizations',
  'work-items': 'Work Items',
};
