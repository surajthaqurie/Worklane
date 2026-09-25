'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertOctagon,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  Bug,
  CheckSquare,
  BookOpen,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge, BadgeSize } from '../ui/Badge';

export interface StateBadgeProps {
  state: string;
  category?: 'PROPOSED' | 'IN_PROGRESS' | 'RESOLVED' | 'COMPLETED' | 'REMOVED' | string;
  size?: BadgeSize;
  className?: string;
}

export function StateBadge({
  state,
  category = 'PROPOSED',
  size = 'sm',
  className = '',
}: StateBadgeProps) {
  const norm = (category || state || '').toUpperCase();

  if (norm.includes('RESOLVED') || norm.includes('COMPLETED') || norm.includes('DONE')) {
    return (
      <Badge
        variant="success"
        size={size}
        icon={<CheckCircle2 className="w-3 h-3 text-[var(--semantic-success-icon)]" />}
        className={className}
      >
        {state}
      </Badge>
    );
  }

  if (norm.includes('PROGRESS') || norm.includes('ACTIVE')) {
    return (
      <Badge
        variant="brand"
        size={size}
        icon={<Clock className="w-3 h-3 text-[var(--brand-primary)]" />}
        className={className}
      >
        {state}
      </Badge>
    );
  }

  if (norm.includes('BLOCKED')) {
    return (
      <Badge
        variant="danger"
        size={size}
        icon={<AlertOctagon className="w-3 h-3 text-[var(--semantic-danger-icon)]" />}
        className={className}
      >
        {state}
      </Badge>
    );
  }

  return (
    <Badge
      variant="default"
      size={size}
      icon={<Circle className="w-2.5 h-2.5 text-[var(--text-muted)]" />}
      className={className}
    >
      {state}
    </Badge>
  );
}

export interface PriorityBadgeProps {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  size?: BadgeSize;
  className?: string;
}

export function PriorityBadge({
  priority,
  size = 'sm',
  className = '',
}: PriorityBadgeProps) {
  const p = (priority || '').toUpperCase();

  switch (p) {
    case 'URGENT':
      return (
        <Badge
          variant="danger"
          size={size}
          icon={<AlertTriangle className="w-3 h-3 text-[var(--semantic-danger-icon)]" />}
          className={className}
        >
          Urgent
        </Badge>
      );
    case 'HIGH':
      return (
        <Badge
          variant="warning"
          size={size}
          icon={<ArrowUp className="w-3 h-3 text-[var(--semantic-warning-icon)]" />}
          className={className}
        >
          High
        </Badge>
      );
    case 'LOW':
      return (
        <Badge
          variant="default"
          size={size}
          icon={<ArrowDown className="w-3 h-3 text-[var(--text-muted)]" />}
          className={className}
        >
          Low
        </Badge>
      );
    case 'MEDIUM':
    default:
      return (
        <Badge
          variant="secondary"
          size={size}
          icon={<Minus className="w-3 h-3 text-[var(--text-secondary)]" />}
          className={className}
        >
          Medium
        </Badge>
      );
  }
}

export interface TypeBadgeProps {
  type: 'TASK' | 'BUG' | 'STORY' | 'FEATURE' | 'EPIC' | string;
  size?: BadgeSize;
  className?: string;
}

export function TypeBadge({ type, size = 'sm', className = '' }: TypeBadgeProps) {
  const t = (type || '').toUpperCase();

  switch (t) {
    case 'BUG':
      return (
        <Badge
          variant="danger"
          size={size}
          icon={<Bug className="w-3 h-3 text-red-500" />}
          className={className}
        >
          Bug
        </Badge>
      );
    case 'STORY':
      return (
        <Badge
          variant="success"
          size={size}
          icon={<BookOpen className="w-3 h-3 text-emerald-500" />}
          className={className}
        >
          Story
        </Badge>
      );
    case 'FEATURE':
      return (
        <Badge
          variant="brand"
          size={size}
          icon={<Sparkles className="w-3 h-3 text-blue-500" />}
          className={className}
        >
          Feature
        </Badge>
      );
    case 'EPIC':
      return (
        <Badge
          variant="warning"
          size={size}
          icon={<Zap className="w-3 h-3 text-amber-500" />}
          className={className}
        >
          Epic
        </Badge>
      );
    case 'TASK':
    default:
      return (
        <Badge
          variant="default"
          size={size}
          icon={<CheckSquare className="w-3 h-3 text-indigo-500" />}
          className={className}
        >
          Task
        </Badge>
      );
  }
}
