'use client';

import { RotateCcw, Check, Plus, EyeOff } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import { getAllWidgetDefinitions } from '../registry';
import { useDashboardContext } from './DashboardContext';

export interface CustomizeDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomizeDashboardModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    layout,
    onToggleWidgetVisibility,
    onResizeWidget,
    onResetLayout,
  } = useDashboardContext();

  const allDefs = getAllWidgetDefinitions();

  const isWidgetVisible = (type: string) => {
    const item = layout.find((w) => w.type === type);
    return item ? item.visible : false;
  };

  const getWidgetColSpan = (type: string) => {
    const item = layout.find((w) => w.type === type);
    return item?.colSpan ?? 1;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Dashboard">
      <div className="space-y-6">
        <p className="text-xs text-[var(--text-secondary)]">
          Configure which widgets appear on your dashboard, adjust their display widths,
          or reset your layout back to defaults.
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {allDefs.map((def) => {
            const visible = isWidgetVisible(def.type);
            const colSpan = getWidgetColSpan(def.type);
            const Icon = def.icon;
            const widgetItem = layout.find((w) => w.type === def.type);

            return (
              <div
                key={def.type}
                className={`flex items-center justify-between p-3 rounded-[var(--radius-card)] border transition-all ${
                  visible
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                    : 'border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      visible
                        ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                        : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                      {def.name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-[280px]">
                      {def.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Size selector if visible */}
                  {visible && widgetItem && (
                    <div className="flex items-center rounded-[var(--radius-button)] border border-[var(--border-subtle)] p-0.5 text-[11px]">
                      {[1, 2, 3].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => onResizeWidget(widgetItem.id, size)}
                          className={`px-2 py-0.5 rounded font-medium transition-colors ${
                            colSpan === size
                              ? 'bg-[var(--brand-primary)] text-white'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {size}x
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Visibility Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (widgetItem) {
                        onToggleWidgetVisibility(widgetItem.id);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium transition-colors cursor-pointer ${
                      visible
                        ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400'
                        : 'bg-[var(--brand-primary)] text-white hover:opacity-90'
                    }`}
                  >
                    {visible ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onResetLayout();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[var(--radius-button)] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Layout
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-colors cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
