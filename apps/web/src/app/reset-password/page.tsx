'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/lib/auth';
import { Zap, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const inputCls = 'w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';

// Landing page for the emailed reset link. Supabase signs the user in from the
// link (tokens in the URL), then we ask for the new password.
export default function ResetPasswordPage() {
  const [status, setStatus]     = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    // Expired or already-used links come back with an error in the URL
    const urlError = new URLSearchParams(window.location.hash.slice(1)).get('error_description')
      ?? new URLSearchParams(window.location.search).get('error_description');
    if (urlError) {
      setLinkError(urlError.replace(/\+/g, ' '));
      setStatus('invalid');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });
    // getSession() waits for supabase-js to finish reading the link's tokens
    supabase.auth.getSession().then(({ data }) => {
      setStatus(s => (s !== 'checking' ? s : data.session ? 'ready' : 'invalid'));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await updatePassword(password);
      setStatus('done');
      // Full navigation so the auth context reloads with the signed-in user
      setTimeout(() => window.location.replace('/'), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Could not update your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        )}

        {status === 'invalid' && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 text-center">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm text-white font-medium">This reset link isn&apos;t valid</p>
            <p className="text-xs text-gray-400 mt-1.5">
              {linkError ? linkError.replace(/\.?$/, '.') : 'It may have expired or already been used.'} Request a new one below.
            </p>
            <Link href="/forgot-password"
              className="mt-4 inline-block rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              Send a new link
            </Link>
          </div>
        )}

        {status === 'done' && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 text-center">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-3" />
            <p className="text-sm text-white font-medium">Password updated</p>
            <p className="text-xs text-gray-400 mt-1.5">Signing you in…</p>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">New password (min 8 chars)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required autoFocus value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls + ' pr-11'} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Confirm new password</label>
              <input type={showPw ? 'text' : 'password'} required value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving…
                </>
              ) : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
