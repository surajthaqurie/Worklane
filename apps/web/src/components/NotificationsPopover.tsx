'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  UserCheck,
  MessageSquare,
  RefreshCw,
  CalendarPlus,
  CalendarMinus,
  GitFork,
  X,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { fetchWithAuth } from '@/hooks/fetcher';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  workItemId: string | null;
  actorId: string;
  metadata: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const userId = '11111111-1111-1111-1111-111111111111';

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_URL}/notifications?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // WebSocket setup for real-time notifications
    try {
      const socket = io(`${API_URL}/notifications`, {
        transports: ['websocket', 'polling'],
        query: { userId },
      });

      socket.on('connect', () => {
        socket.emit('subscribe', { userId });
      });

      socket.on('notification', (newNotif: Notification) => {
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((count) => count + 1);
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.error('Failed to initialize notification WebSocket', err);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: updated.readAt || new Date().toISOString() } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/notifications/read-all`, {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

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

  const formatText = (n: Notification) => {
    const meta = n.metadata || {};
    const keyStr = meta.key ? `[${meta.key}] ` : '';
    const titleStr = meta.title || 'Work Item';

    switch (n.type) {
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
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 text-[var(--text-primary)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full dark:bg-blue-950 dark:text-blue-300">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && markAsRead(n.id)}
                    className={`p-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[var(--bg-surface-hover)] ${
                      isUnread ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getTypeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${isUnread ? 'font-medium' : 'text-[var(--text-secondary)]'}`}>
                        {formatText(n)}
                      </p>
                      {n.metadata?.snippet && (
                        <p className="text-[11px] text-[var(--text-secondary)] truncate italic mt-0.5">
                          "{n.metadata.snippet}"
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-70">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {isUnread && (
                      <span
                        className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5"
                        title="Unread"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
