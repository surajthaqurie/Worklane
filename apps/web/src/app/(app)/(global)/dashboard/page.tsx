import { PageHeader } from "@/components/layout/page-header";

export default function DashboardPage() {
  return (
    <div className="w-full flex flex-col space-y-8">
      <PageHeader 
        title="Dashboard" 
        description="Your projects and recent activity." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <section>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">My Work</h2>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-4 flex gap-8">
              <div>
                <div className="text-[24px] font-semibold">12</div>
                <div className="text-[13px] text-[var(--text-secondary)]">Open</div>
              </div>
              <div>
                <div className="text-[24px] font-semibold text-[var(--status-in-progress)]">4</div>
                <div className="text-[13px] text-[var(--text-secondary)]">In progress</div>
              </div>
              <div>
                <div className="text-[24px] font-semibold text-[var(--status-done)]">8</div>
                <div className="text-[13px] text-[var(--text-secondary)]">Completed</div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Recent Projects</h2>
              <button className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                View all projects
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'Fitness Platform', initials: 'FP', open: 24 },
                { name: 'Billing System', initials: 'BS', open: 11 }
              ].map(p => (
                <div key={p.name} className="group bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] rounded-[var(--radius-card)] p-4 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-[var(--radius-button)] bg-[var(--bg-surface-hover)] flex items-center justify-center text-[12px] font-medium text-[var(--text-secondary)] group-hover:bg-[var(--bg-surface-selected)] group-hover:text-[var(--brand-primary)] transition-colors">
                      {p.initials}
                    </div>
                    <div className="font-medium text-[14px] text-[var(--text-primary)]">{p.name}</div>
                  </div>
                  <div className="text-[13px] text-[var(--text-secondary)]">{p.open} open items</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-1 space-y-6">
          <section>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="text-[13px]">
                <span className="font-medium text-[var(--text-primary)]">APP-124</span>
                <span className="text-[var(--text-secondary)]"> was completed</span>
              </div>
              <div className="text-[13px]">
                <span className="font-medium text-[var(--text-primary)]">APP-123</span>
                <span className="text-[var(--text-secondary)]"> moved to In Progress</span>
              </div>
              <div className="text-[13px]">
                <span className="font-medium text-[var(--text-primary)]">New comment</span>
                <span className="text-[var(--text-secondary)]"> on APP-119</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
