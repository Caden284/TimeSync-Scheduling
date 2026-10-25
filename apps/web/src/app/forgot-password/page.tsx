'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth';
import { Zap, AlertCircle, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail]           = useState('');
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Could not send the reset email. Try again in a minute.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-sm text-gray-400 mt-1 text-center">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 text-center">
            <Mail size={28} className="text-indigo-400 mx-auto mb-3" />
            {/* Same message whether or not the account exists, so this page can't be used to probe for emails */}
            <p className="text-sm text-white font-medium">Check your inbox</p>
            <p className="text-xs text-gray-400 mt-1.5">
              If an account exists for <span className="text-gray-200">{email.trim()}</span>, a reset link
              is on its way. It may take a minute — check your spam folder too.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email address</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@organization.com" autoFocus
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending…
                </>
              ) : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
