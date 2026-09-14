export default async function QueriesPage() {
  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Queries</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Build custom filters to track work across your project.</p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 gap-3">
          <button className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors">
            + New Query
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center border border-dashed border-[var(--border-strong)] rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]">
        <div className="text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">No queries saved yet.</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">Queries you create will appear here.</p>
        </div>
      </div>
    </div>
  );
}
