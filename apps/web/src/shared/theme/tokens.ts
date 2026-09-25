/**
 * Worklane Design System Tokens
 * Centralized design tokens for colors, typography, spacing, shadows, radius, and semantic states.
 */

export const tokens = {
  colors: {
    brand: {
      primary: 'var(--brand-primary)',
      hover: 'var(--brand-primary-hover)',
      subtle: 'var(--brand-primary-subtle)',
      foreground: 'var(--brand-primary-foreground)',
    },
    surface: {
      app: 'var(--bg-app)',
      sidebar: 'var(--bg-sidebar)',
      base: 'var(--bg-surface)',
      elevated: 'var(--bg-surface-elevated)',
      subtle: 'var(--bg-surface-subtle)',
      hover: 'var(--bg-surface-hover)',
      selected: 'var(--bg-surface-selected)',
      overlay: 'var(--bg-overlay)',
    },
    text: {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      muted: 'var(--text-muted)',
      disabled: 'var(--text-disabled)',
      inverse: 'var(--text-inverse)',
      brand: 'var(--brand-primary)',
    },
    border: {
      subtle: 'var(--border-subtle)',
      default: 'var(--border-default)',
      strong: 'var(--border-strong)',
      focus: 'var(--border-focus)',
    },
    semantic: {
      success: {
        bg: 'var(--semantic-success-bg)',
        border: 'var(--semantic-success-border)',
        text: 'var(--semantic-success-text)',
        icon: 'var(--semantic-success-icon)',
      },
      warning: {
        bg: 'var(--semantic-warning-bg)',
        border: 'var(--semantic-warning-border)',
        text: 'var(--semantic-warning-text)',
        icon: 'var(--semantic-warning-icon)',
      },
      danger: {
        bg: 'var(--semantic-danger-bg)',
        border: 'var(--semantic-danger-border)',
        text: 'var(--semantic-danger-text)',
        icon: 'var(--semantic-danger-icon)',
      },
      info: {
        bg: 'var(--semantic-info-bg)',
        border: 'var(--semantic-info-border)',
        text: 'var(--semantic-info-text)',
        icon: 'var(--semantic-info-icon)',
      },
      offline: {
        bg: 'var(--semantic-offline-bg)',
        border: 'var(--semantic-offline-border)',
        text: 'var(--semantic-offline-text)',
        icon: 'var(--semantic-offline-icon)',
      },
      syncing: {
        bg: 'var(--semantic-syncing-bg)',
        border: 'var(--semantic-syncing-border)',
        text: 'var(--semantic-syncing-text)',
        icon: 'var(--semantic-syncing-icon)',
      },
      permissionDenied: {
        bg: 'var(--semantic-denied-bg)',
        border: 'var(--semantic-denied-border)',
        text: 'var(--semantic-denied-text)',
        icon: 'var(--semantic-denied-icon)',
      },
    },
    workItem: {
      status: {
        todo: 'var(--status-todo)',
        inProgress: 'var(--status-in-progress)',
        done: 'var(--status-done)',
        blocked: 'var(--status-blocked)',
      },
      priority: {
        low: 'var(--priority-low)',
        medium: 'var(--priority-medium)',
        high: 'var(--priority-high)',
        urgent: 'var(--priority-urgent)',
      },
      type: {
        task: '#3b82f6',
        bug: '#ef4444',
        story: '#10b981',
        feature: '#8b5cf6',
        epic: '#f59e0b',
      },
    },
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '14px',
    full: '9999px',
  },
  shadows: {
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },
  typography: {
    fontSans: "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'Geist Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    sizes: {
      '2xs': '10px',
      xs: '12px',
      sm: '13px',
      base: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
    },
  },
  zIndex: {
    dropdown: 40,
    sticky: 30,
    drawer: 50,
    modal: 50,
    popover: 60,
    toast: 70,
    tooltip: 80,
  },
} as const;

export type ThemeTokens = typeof tokens;
