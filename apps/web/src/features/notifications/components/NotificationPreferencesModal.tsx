'use client';

import React from 'react';
import { X, Settings, Bell, Mail, AtSign, UserCheck, Eye } from 'lucide-react';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotifications';
import { NotificationPreferences } from '@/shared/types/notifications';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updateMut = useUpdateNotificationPreferences();

  if (!isOpen) return null;

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    updateMut.mutate({
      [key]: !prefs[key],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-base">Notification Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading || !prefs ? (
            <div className="text-center py-8 text-sm text-[var(--text-secondary)]">Loading preferences...</div>
          ) : (
            <>
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Delivery Channels
                </h4>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">In-App Notifications</div>
                      <div className="text-xs text-[var(--text-secondary)]">Real-time socket alerts & badge</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.channelInApp}
                    onChange={() => handleToggle('channelInApp')}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-sm font-medium">Email Notifications</div>
                      <div className="text-xs text-[var(--text-secondary)]">Queued email dispatches</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.channelEmail}
                    onChange={() => handleToggle('channelEmail')}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Notification Events
                </h4>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20">
                  <div className="flex items-center gap-3">
                    <AtSign className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-sm font-medium">Mentions</div>
                      <div className="text-xs text-[var(--text-secondary)]">When tagged with @username in comments</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyMentions}
                    onChange={() => handleToggle('notifyMentions')}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium">Assigned Items</div>
                      <div className="text-xs text-[var(--text-secondary)]">When work items are assigned to you</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyAssigned}
                    onChange={() => handleToggle('notifyAssigned')}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20">
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-cyan-500" />
                    <div>
                      <div className="text-sm font-medium">Followed Items</div>
                      <div className="text-xs text-[var(--text-secondary)]">Updates on work items you follow</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyFollowed}
                    onChange={() => handleToggle('notifyFollowed')}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/30">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:text-blue-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
