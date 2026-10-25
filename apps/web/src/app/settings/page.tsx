'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/auth-guard';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { inviteUser } from '@/lib/auth';
import {
  updateOrg, createDepartment, deleteDepartment, getEmployees,
  getOrgUsers, updateUserProfile,
} from '@/lib/db';
import { cn, getContrastColor } from '@/lib/utils';
import { Building2, Users, Layers, Check, Plus, Trash2, Loader2 } from 'lucide-react';

const NAV_SECTIONS = [
  { id: 'organization', label: 'Organization',   icon: Building2 },
  { id: 'departments',  label: 'Departments',    icon: Layers },
  { id: 'users',        label: 'Users & Access', icon: Users },
] as const;

type SectionId = typeof NAV_SECTIONS[number]['id'];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
];
const VERTICALS = [
  ['healthcare', 'Healthcare'], ['library', 'Library'], ['university', 'University'], ['restaurant', 'Restaurant'],
  ['retail', 'Retail'], ['warehouse', 'Warehouse'], ['government', 'Government'], ['security', 'Security'],
  ['events', 'Events'], ['manufacturing', 'Manufacturing'], ['nonprofit', 'Nonprofit'], ['call_center', 'Call Center'],
  ['hotel', 'Hotel'], ['airline', 'Airline'], ['construction', 'Construction'], ['other', 'Other'],
];
const COLORS = ['#6366f1', '#ef4444', '#f97316', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function SettingsPage() {
  return <AuthGuard><Settings /></AuthGuard>;
}

function Settings() {
  const { copilotOpen } = useAppStore();
  const [section, setSection] = useState<SectionId>('organization');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title="Settings" subtitle="Manage your organization" />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <nav className="w-52 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4 px-2">
            {NAV_SECTIONS.map(sec => {
              const Icon = sec.icon;
              return (
                <button key={sec.id} onClick={() => setSection(sec.id)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                    section === sec.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
                  <Icon size={15} className="shrink-0" />
                  {sec.label}
                </button>
              );
            })}
          </nav>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-2xl space-y-6">
              {section === 'organization' && <OrganizationSection />}
              {section === 'departments' && <DepartmentsSection />}
              {section === 'users' && <UsersSection />}
            </div>
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}

// ── Organization ─────────────────────────────────────────────────────────────

function OrganizationSection() {
  const { addToast } = useAppStore();
  const { org, refresh } = useOrgData();
  const [form, setForm] = useState({ name: '', vertical: 'other', timezone: 'America/New_York', primaryColor: '#6366f1' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) setForm({
      name: org.name ?? '', vertical: org.vertical ?? 'other',
      timezone: org.timezone ?? 'America/New_York', primaryColor: org.primaryColor ?? '#6366f1',
    });
  }, [org]);

  async function save() {
    if (!org || form.name.trim().length < 2) return;
    setSaving(true);
    try {
      await updateOrg(org.id, {
        ...form, name: form.name.trim(),
        logoInitials: form.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      });
      await refresh();
      addToast({ type: 'success', title: 'Organization saved' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not save', message: e?.message });
    } finally {
      setSaving(false);
    }
  }

  const tzOptions = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  return (
    <>
      <SectionHeader title="Organization" desc="Your organization's name, industry, time zone, and brand color." />
      <SettingsCard>
        <Field label="Organization Name">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Industry">
            <select value={form.vertical} onChange={e => setForm(f => ({ ...f, vertical: e.target.value }))} className={inputCls}>
              {VERTICALS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Time Zone">
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className={inputCls}>
              {tzOptions.map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Brand Color">
          <div className="flex items-center gap-3">
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, primaryColor: c }))} aria-label={`Use color ${c}`}
                className={cn('h-7 w-7 rounded-full transition-transform', form.primaryColor === c && 'ring-2 ring-offset-2 ring-gray-400 scale-110')}
                style={{ backgroundColor: c }} />
            ))}
            <div className="ml-2 h-8 px-3 rounded-lg flex items-center text-xs font-bold"
              style={{ backgroundColor: form.primaryColor, color: getContrastColor(form.primaryColor) }}>
              {form.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'TS'}
            </div>
          </div>
        </Field>
      </SettingsCard>
      <div className="flex justify-end">
        <Button variant="primary" onClick={save} loading={saving} disabled={!org || form.name.trim().length < 2}>Save Changes</Button>
      </div>
    </>
  );
}

// ── Departments ──────────────────────────────────────────────────────────────

function DepartmentsSection() {
  const { addToast } = useAppStore();
  const { profile } = useAuth();
  const { departments, refresh } = useOrgData();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState<string | null>(null);

  async function add() {
    if (!profile?.orgId || !name.trim()) return;
    setBusy('add');
    try {
      await createDepartment(profile.orgId, name.trim(), color);
      await refresh();
      setName('');
      setColor(COLORS[(departments.length + 1) % COLORS.length]);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not add department', message: e?.message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, deptName: string) {
    if (!window.confirm(`Delete the ${deptName} department? Employees and shifts keep their current label.`)) return;
    setBusy(id);
    try {
      await deleteDepartment(id);
      await refresh();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not delete department', message: e?.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SectionHeader title="Departments" desc="Used to group employees and shifts. Everyone in your organization sees the same list." />
      <SettingsCard>
        <div className="flex gap-2 items-end">
          <Field label="New department">
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="e.g. Reference Desk" className={inputCls} />
          </Field>
          <div className="flex gap-1 pb-1.5">
            {COLORS.slice(0, 6).map(c => (
              <button key={c} onClick={() => setColor(c)} aria-label={`Use color ${c}`}
                className={cn('h-6 w-6 rounded-full', color === c && 'ring-2 ring-offset-1 ring-gray-400')} style={{ backgroundColor: c }} />
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={add} loading={busy === 'add'} disabled={!name.trim()} leftIcon={<Plus size={13} />}>
            Add
          </Button>
        </div>
        {departments.length === 0 ? (
          <p className="text-sm text-gray-500">No departments yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 -mx-1">
            {departments.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-1 py-2.5">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color ?? '#6366f1' }} />
                <span className="flex-1 text-sm text-gray-900">{d.name}</span>
                <button onClick={() => remove(d.id, d.name)} disabled={busy !== null} aria-label={`Delete ${d.name}`}
                  className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}

// ── Users & Access ───────────────────────────────────────────────────────────

const NEW_EMPLOYEE = '__new__';

function UsersSection() {
  const { addToast } = useAppStore();
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    if (!profile?.orgId) return;
    const [u, e] = await Promise.all([getOrgUsers(profile.orgId), getEmployees(profile.orgId)]);
    setUsers(u); setEmployees(e); setLoading(false);
  }
  useEffect(() => { load().catch(() => setLoading(false)); }, [profile?.orgId]);

  const linkedIds = new Set(users.map(u => u.employeeId).filter(Boolean));

  async function change(user: any, patch: { role?: 'admin' | 'staff'; employeeId?: string | null }) {
    setSaving(user.id);
    try {
      const updated = await updateUserProfile(user.id, patch);
      setUsers(us => us.map(u => (u.id === user.id ? updated : u)));
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not update user', message: e?.message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <SectionHeader title="Users & Access"
        desc="Admins manage everything. Staff see their own published shifts and can request time off — link each staff login to their employee record so their shifts show up." />
      <SettingsCard>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a user</p>
        <InviteUserForm employees={employees.filter(e => !linkedIds.has(e.id))} onCreated={() => load()} />
      </SettingsCard>
      <SettingsCard>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current users</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-indigo-500" /></div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map(u => {
              const isMe = u.userId === profile?.userId;
              return (
                <li key={u.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium text-gray-900">{`${u.firstName} ${u.lastName}`.trim() || u.email}{isMe && <span className="text-gray-400 font-normal"> (you)</span>}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <select value={u.role} disabled={isMe || saving === u.id} onChange={e => change(u, { role: e.target.value as 'admin' | 'staff' })}
                    aria-label={`Role for ${u.email}`} className={cn(inputCls, 'w-auto py-1.5 text-xs')}>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                  <select value={u.employeeId ?? ''} disabled={saving === u.id} onChange={e => change(u, { employeeId: e.target.value || null })}
                    aria-label={`Employee record for ${u.email}`} className={cn(inputCls, 'w-48 py-1.5 text-xs', u.role === 'staff' && !u.employeeId && 'border-amber-400')}>
                    <option value="">{u.role === 'staff' ? '⚠ Not linked to an employee' : 'No employee record'}</option>
                    {employees.filter(e => e.id === u.employeeId || !linkedIds.has(e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select>
                  {saving === u.id && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}

function InviteUserForm({ employees, onCreated }: { employees: any[]; onCreated: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'staff', employee: NEW_EMPLOYEE });
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  function update(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  // Picking an existing employee fills in their name and email.
  function pickEmployee(id: string) {
    const emp = employees.find(e => e.id === id);
    setForm(f => ({ ...f, employee: id, ...(emp ? { firstName: emp.firstName, lastName: emp.lastName, email: emp.email || f.email } : {}) }));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.orgId) return;
    setStatus('saving'); setErrMsg('');
    try {
      const link = form.employee === NEW_EMPLOYEE
        ? { createEmployee: form.role === 'staff' }
        : { employeeId: form.employee };
      await inviteUser(form.email, form.password, form.firstName, form.lastName, form.role as 'admin' | 'staff', link);
      setStatus('done');
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'staff', employee: NEW_EMPLOYEE });
      onCreated();
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Failed to create user.');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      {status === 'done' && <p className="text-sm text-green-600 font-medium flex items-center gap-1.5"><Check size={14} /> User created. They can sign in now.</p>}
      {status === 'error' && <p className="text-sm text-red-500">{errMsg}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select value={form.role} onChange={e => update('role', e.target.value)} className={inputCls}>
            <option value="staff">Staff (own schedule + time off)</option>
            <option value="admin">Admin (full access)</option>
          </select>
        </Field>
        <Field label="Employee record">
          <select value={form.employee} onChange={e => pickEmployee(e.target.value)} className={inputCls}>
            <option value={NEW_EMPLOYEE}>{form.role === 'staff' ? 'Create a new employee' : 'None'}</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name"><input required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} /></Field>
        <Field label="Last Name"><input required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Email"><input type="email" required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} /></Field>
      <Field label="Temporary Password" hint="At least 8 characters. They can change it with “Forgot your password?”.">
        <input type="password" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} className={inputCls} />
      </Field>
      <Button type="submit" variant="primary" size="sm" loading={status === 'saving'}>Create User</Button>
    </form>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-gray-200 pb-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
