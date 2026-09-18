'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { UserCheck, MessageSquare, RefreshCw, CalendarPlus, CalendarMinus, GitFork, Bell } from 'lucide-react';
import { Notification } from '@/shared/types/notifications';

export interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

export function NotificationItem({ notification: n, onMarkAsRead }: NotificationItemProps) {
  const isUnread = !n.readAt;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ASSIGNED':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'MENTIONED':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'STATE_CHANGED':
        return <RefreshCw className="w-4 h-4 text-emerald-500" />;
      case 'ADDED_TO_SPRINT':
        return <CalendarPlus className="w-4 h-4 text-amber-500" />;
      case 'REMOVED_FROM_SPRINT':
        return <CalendarMinus className="w-4 h-4 text-rose-500" />;
      case 'PARENT_CHANGED':
        return <GitFork className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatText = (notif: Notification) => {
    const meta = notif.metadata || {};
    const keyStr = meta.key ? `[${meta.key}] ` : '';
    const titleStr = meta.title || 'Work Item';

    switch (notif.type) {
      case 'ASSIGNED':
        return `Assigned to you: ${keyStr}${titleStr}`;
      case 'MENTIONED':
        return `Mentioned you in comment on ${keyStr}${titleStr}`;
      case 'STATE_CHANGED':
        return `State changed from ${meta.oldState || 'unknown'} to ${meta.newState || 'unknown'} on ${keyStr}${titleStr}`;
      case 'ADDED_TO_SPRINT':
        return `Added ${keyStr}${titleStr} to sprint ${meta.sprintName ? `"${meta.sprintName}"` : ''}`;
      case 'REMOVED_FROM_SPRINT':
        return `Removed ${keyStr}${titleStr} from sprint ${meta.sprintName ? `"${meta.sprintName}"` : ''}`;
      case 'PARENT_CHANGED':
        return `Parent relationship changed for ${keyStr}${titleStr}`;
      default:
        return `Notification for ${keyStr}${titleStr}`;
    }
  };

  return (
    <div
      onClick={() => isUnread && onMarkAsRead(n.id)}
      className={`p-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[var(--bg-surface-hover)] ${
        isUnread ? 'bg-blue-500/5' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">{getTypeIcon(n.type)}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${isUnread ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {formatText(n)}
        </p>
        {n.metadata?.snippet && (
          <p className="text-[11px] text-[var(--text-secondary)] truncate italic mt-0.5">
            &ldquo;{String(n.metadata.snippet)}&rdquo;
          </p>
        )}
        <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-70">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" title="Unread" />}
    </div>
  );
}
