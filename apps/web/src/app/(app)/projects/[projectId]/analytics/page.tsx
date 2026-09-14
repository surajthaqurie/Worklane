export default async function AnalyticsPage() {
  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Analytics</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Velocity, burndown, and delivery metrics.</p>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-6">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-6">Sprint Burndown</h3>
          <div className="h-48 flex items-center justify-center bg-[var(--bg-surface-hover)] rounded-[var(--radius-card)] text-[13px] text-[var(--text-muted)] border border-dashed border-[var(--border-strong)]">
            Chart data unavailable
          </div>
        </div>
        <div className="border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-6">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-6">Team Velocity</h3>
          <div className="h-48 flex items-center justify-center bg-[var(--bg-surface-hover)] rounded-[var(--radius-card)] text-[13px] text-[var(--text-muted)] border border-dashed border-[var(--border-strong)]">
            Chart data unavailable
          </div>
        </div>
      </div>
    </div>
  );
}
