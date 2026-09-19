'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/context/AuthContext';
import { formatApiError } from '@/shared/utils/error';
import { UserPlus, AlertCircle, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
    } catch (err) {
      setError(formatApiError(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app,#f8fafc)] p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-[var(--bg-surface,#ffffff)] border border-[var(--border-subtle,#e2e8f0)] rounded-xl shadow-lg transition-all">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-4 shadow-md">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary,#0f172a)] tracking-tight">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary,#64748b)]">
            Get started with Worklane project management
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#64748b)] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-subtle,#cbd5e1)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#64748b)] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-subtle,#cbd5e1)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#64748b)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-subtle,#cbd5e1)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary,#94a3b8)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--border-subtle,#e2e8f0)] text-center text-sm text-[var(--text-secondary,#64748b)]">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
