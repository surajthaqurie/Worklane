'use client';
import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  return (
    <div className="w-full flex flex-col space-y-8">
      <PageHeader 
        title="Settings" 
        description="Manage your account settings and preferences." 
      />
      
      <div className="max-w-2xl space-y-8">
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">Profile Information</h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Full Name</label>
              <input 
                type="text" 
                defaultValue="Suraj Chand" 
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] p-2 text-[13px] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">Email Address</label>
              <input 
                type="email" 
                defaultValue="suraj@example.com" 
                disabled
                className="w-full border border-[var(--border-default)] rounded-[var(--radius-input)] p-2 text-[13px] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] cursor-not-allowed"
              />
            </div>
            <div className="pt-2">
              <button className="px-4 py-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-default)] text-[var(--text-primary)] text-[13px] font-medium rounded-[var(--radius-button)] transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--priority-high)] mb-4">Danger Zone</h2>
          <div className="bg-[var(--bg-surface)] border border-[var(--priority-high)] rounded-[var(--radius-card)] p-6 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)]">Delete Account</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">Permanently delete your account and all projects.</p>
            </div>
            <button className="px-4 py-2 bg-[var(--priority-urgent)] hover:bg-red-800 text-white text-[13px] font-medium rounded-[var(--radius-button)] transition-colors">
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
