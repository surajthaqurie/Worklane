'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, X, Settings, WifiOff, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '../hooks/useNotifications';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { NotificationItem } from './NotificationItem';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const socketState = useNotificationSocket();

  const { data, isLoading, isError } = useNotifications({ limit: 20 });
  const markAsReadMut = useMarkNotificationAsRead();
  const markAllAsReadMut = useMarkAllNotificationsAsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Close popover when clicking outside
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

  return (
    <>
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
                    onClick={() => markAllAsReadMut.mutate()}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsPrefsOpen(true)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded"
                  title="Notification settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {socketState.error && (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
                  <WifiOff className="w-3 h-3 shrink-0" />
                  <span>Real-time updates unavailable — {socketState.error}.</span>
                </div>
              )}
              {isError && notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-red-600 dark:text-red-400">
                  Failed to load notifications.
                </div>
              ) : isLoading && notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)]">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onMarkAsRead={(id) => markAsReadMut.mutate(id)} />
                ))
              )}
            </div>

            <div className="border-t border-[var(--border-subtle)]">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                View all notifications
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <NotificationPreferencesModal isOpen={isPrefsOpen} onClose={() => setIsPrefsOpen(false)} />
    </>
  );
}
