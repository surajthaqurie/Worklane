'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  UserCheck,
  MessageSquare,
  RefreshCw,
  CalendarPlus,
  CalendarMinus,
  GitFork,
  Bell,
  PenLine,
  Eye,
} from 'lucide-react';
import { Notification } from '@/shared/types/notifications';

export interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  /** When provided, clicking the item also navigates (e.g. to the work item). */
  onNavigate?: (notification: Notification) => void;
}

export function NotificationItem({ notification: n, onMarkAsRead, onNavigate }: NotificationItemProps) {
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
      case 'WORK_ITEM_UPDATED':
        return <PenLine className="w-4 h-4 text-sky-500" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-violet-500" />;
      case 'FOLLOWED':
        return <Eye className="w-4 h-4 text-teal-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatText = (notif: Notification) => {
    const meta = notif.metadata || {};
    const who = notif.actorName || notif.actor?.name || 'Someone';

    // Prefer the project-enriched key/title; fall back to event metadata.
    const keyStr = notif.workItemKey || (meta.key ? `[${meta.key}]` : null);
    const titleStr = notif.workItemTitle || meta.title || 'work item';
    const label = keyStr ? `${keyStr} ${titleStr}` : titleStr;

    switch (notif.type) {
      case 'ASSIGNED':
        return `${who} assigned you to ${label}`;
      case 'MENTIONED':
        return `${who} mentioned you in a comment on ${label}`;
      case 'STATE_CHANGED':
        return `${who} changed the state of ${label} from ${meta.oldState || 'unknown'} to ${meta.newState || 'unknown'}`;
      case 'ADDED_TO_SPRINT':
        return `${who} added ${label} to sprint ${meta.sprintName ? `"${meta.sprintName}"` : ''}`;
      case 'REMOVED_FROM_SPRINT':
        return `${who} removed ${label} from sprint ${meta.sprintName ? `"${meta.sprintName}"` : ''}`;
      case 'PARENT_CHANGED':
        return `${who} changed the parent of ${label}`;
      case 'WORK_ITEM_UPDATED':
        return `${who} updated ${label}`;
      case 'COMMENT_ADDED':
        return `${who} commented on ${label}`;
      case 'FOLLOWED':
        return `${who} started following ${label}`;
      default:
        return `${who} • ${notif.type.replace(/_/g, ' ').toLowerCase()} on ${label}`;
    }
  };

  const handleClick = () => {
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(n.id);
    }
    onNavigate?.(n);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
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