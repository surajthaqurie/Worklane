'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/components/ui/Toast';
import { useTheme } from '@/shared/components/providers';
import { formatApiError } from '@/shared/utils/error';
import { UserPlus, AlertCircle, ArrowRight, Eye, EyeOff, Sun, Moon } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const { showError, showSuccess } = useToast();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters long';
      setError(msg);
      showError('Validation Error', msg);
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      showSuccess('Account Created!', 'Welcome to Worklane.');
    } catch (err) {
      const msg = formatApiError(err, 'Registration failed. Please try again.');
      setError(msg);
      showError('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app,#f9fafb)] p-4 relative transition-colors duration-200">
      {/* Top right Theme Toggle Switch */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-default,#e5e7eb)] bg-[var(--bg-surface,#ffffff)] text-[var(--text-secondary,#4b5563)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-sm text-xs font-semibold"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="max-w-md w-full space-y-8 p-8 bg-[var(--bg-surface,#ffffff)] border border-[var(--border-default,#e5e7eb)] rounded-xl shadow-lg transition-colors duration-200">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-4 shadow-md">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary,#111827)] tracking-tight">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary,#4b5563)]">
            Get started with Worklane project management
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#4b5563)] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-default,#d1d5db)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted,#9ca3af)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#4b5563)] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-default,#d1d5db)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted,#9ca3af)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#4b5563)] mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-[var(--border-default,#d1d5db)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted,#9ca3af)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer z-10 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
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
        <div className="pt-4 border-t border-[var(--border-subtle,#e5e7eb)] text-center text-sm text-[var(--text-secondary,#4b5563)]">
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
