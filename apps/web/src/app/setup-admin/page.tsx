'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminUser } from '@/lib/auth';
import { createOrg } from '@/lib/db';
import { Zap, CheckCircle, AlertCircle } from 'lucide-react';

const inputCls = 'w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';

export default function SetupAdminPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    orgName: '', vertical: 'library',
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  function update(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      // Create org first
      const org = await createOrg({
        name: form.orgName,
        vertical: form.vertical,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        primaryColor: '#6366f1',
        logoInitials: form.orgName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
      });
      // Create admin user linked to that org
      await createAdminUser(form.email, form.password, form.firstName, form.lastName, org.$id);
      setStep('done');
      setTimeout(() => router.replace('/schedule'), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Setup failed. Check that the database collections exist.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Admin account created!</h1>
          <p className="text-gray-400 text-sm">Redirecting to your schedule…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">First-time Setup</h1>
          <p className="text-sm text-gray-400 mt-1">Create your organization and admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0" /> {error}
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Organization</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Organization Name</label>
              <input required value={form.orgName} onChange={e => update('orgName', e.target.value)}
                placeholder="Georgia State Library" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Industry</label>
              <select value={form.vertical} onChange={e => update('vertical', e.target.value)} className={inputCls}>
                <option value="library">Library</option>
                <option value="healthcare">Healthcare</option>
                <option value="restaurant">Restaurant</option>
                <option value="retail">Retail</option>
                <option value="education">Education</option>
                <option value="government">Government</option>
                <option value="warehouse">Warehouse</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin Account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">First Name</label>
                <input required value={form.firstName} onChange={e => update('firstName', e.target.value)}
                  placeholder="Jane" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Last Name</label>
                <input required value={form.lastName} onChange={e => update('lastName', e.target.value)}
                  placeholder="Smith" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)}
                placeholder="admin@library.org" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Password (min 8 chars)</label>
              <input type="password" required value={form.password} onChange={e => update('password', e.target.value)}
                placeholder="••••••••" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Confirm Password</label>
              <input type="password" required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)}
                placeholder="••••••••" className={inputCls} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
            {loading ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Setting up…</> : 'Create Organization & Admin Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-700">
          This page only works once. After setup, use /login.
        </p>
      </div>
    </div>
  );
}
