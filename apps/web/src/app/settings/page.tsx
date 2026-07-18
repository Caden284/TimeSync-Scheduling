'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { mockOrg } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import {
  Building2, Bell, Shield, Link, Palette, Users,
  Clock, CreditCard, ChevronRight, Check, Globe,
} from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { inviteUser } from '@/lib/auth';
import { useAuth } from '@/context/auth-context';

function InviteUserForm() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'staff' });
  const [status, setStatus] = useState<'idle'|'saving'|'done'|'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  function update(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      await inviteUser(
        form.email, form.password, form.firstName, form.lastName,
        form.role as 'admin' | 'staff', profile?.orgId ?? '',
      );
      setStatus('done');
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'staff' });
    } catch (err: any) {
      setErrMsg(err?.message ?? 'Failed to create user.');
      setStatus('error');
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  return (
    <form onSubmit={handleInvite} className="col-span-2 space-y-3">
      {status === 'done' && <p className="text-sm text-green-600 font-medium">✅ User created successfully. They can now log in.</p>}
      {status === 'error' && <p className="text-sm text-red-500">{errMsg}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-600 mb-1">First Name</label>
          <input required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs text-gray-600 mb-1">Last Name</label>
          <input required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} /></div>
      </div>
      <div><label className="block text-xs text-gray-600 mb-1">Email</label>
        <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">Temporary Password (min 8 chars)</label>
        <input type="password" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} className={inputCls} /></div>
      <div><label className="block text-xs text-gray-600 mb-1">Role</label>
        <select value={form.role} onChange={e => update('role', e.target.value)} className={inputCls}>
          <option value="staff">Staff (view own schedule only)</option>
          <option value="admin">Admin (full access)</option>
        </select>
      </div>
      <Button type="submit" variant="primary" size="sm" disabled={status === 'saving'}>
        {status === 'saving' ? 'Creating…' : 'Create User Account'}
      </Button>
    </form>
  );
}

const NAV_SECTIONS = [
  { id: 'organization', label: 'Organization',   icon: Building2 },
  { id: 'users',        label: 'Users & Access', icon: Users },
  { id: 'scheduling',   label: 'Scheduling',     icon: Clock },
  { id: 'notifications',label: 'Notifications',  icon: Bell },
  { id: 'security',     label: 'Security & Auth', icon: Shield },
  { id: 'integrations', label: 'Integrations',   icon: Link },
  { id: 'appearance',   label: 'Appearance',     icon: Palette },
  { id: 'billing',      label: 'Billing & Plan', icon: CreditCard },
];

const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Pacific/Honolulu'];
const VERTICALS = ['Healthcare', 'Library', 'University', 'Restaurant', 'Retail', 'Warehouse', 'Government', 'Security', 'Events', 'Manufacturing', 'Nonprofit', 'Call Center', 'Hotel', 'Airline', 'Construction', 'Other'];

export default function SettingsPage() {
  const { setOrg, copilotOpen } = useAppStore();
  const [activeSection, setActiveSection] = useState('organization');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    orgName: mockOrg.name,
    vertical: 'Healthcare',
    timezone: mockOrg.timezone,
    locale: 'en-US',
    currency: 'USD',
    primaryColor: mockOrg.primaryColor,
    weekStart: 'sunday',
    defaultShiftDuration: '12',
    overtimeThreshold: '40',
    minRestHours: '10',
    emailNotifications: true,
    smsNotifications: false,
    slackNotifications: false,
    shiftPublished: true,
    shiftSwapRequests: true,
    scheduleChanges: true,
    mfaRequired: false,
    sessionTimeout: '24',
    ipWhitelist: '',
  });

  useEffect(() => { setOrg(mockOrg); }, []);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function update(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title="Settings" subtitle="Manage your organization configuration" />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Settings sidebar */}
            <nav className="w-52 shrink-0 border-r border-gray-200 bg-white overflow-y-auto py-4 px-2">
              {NAV_SECTIONS.map(sec => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                      activeSection === sec.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon size={15} className="shrink-0" />
                    {sec.label}
                  </button>
                );
              })}
            </nav>

            {/* Settings content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl space-y-6">

                {/* ── Organization ─────────────────────── */}
                {activeSection === 'organization' && (
                  <>
                    <SectionHeader title="Organization" desc="Basic information about your organization." />
                    <SettingsCard>
                      <Field label="Organization Name">
                        <input type="text" value={form.orgName} onChange={e => update('orgName', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="Industry Vertical">
                        <select value={form.vertical} onChange={e => update('vertical', e.target.value)} className={inputCls}>
                          {VERTICALS.map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Primary Timezone">
                        <select value={form.timezone} onChange={e => update('timezone', e.target.value)} className={inputCls}>
                          {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
                        </select>
                      </Field>
                      <Field label="Currency">
                        <select value={form.currency} onChange={e => update('currency', e.target.value)} className={inputCls}>
                          {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="Organization Slug" hint="Used in URLs — contact support to change">
                        <input type="text" value="metro-general" disabled className={cn(inputCls, 'bg-gray-50 text-gray-400 cursor-not-allowed')} />
                      </Field>
                    </SettingsCard>
                  </>
                )}

                {/* ── Scheduling ────────────────────────── */}
                {activeSection === 'scheduling' && (
                  <>
                    <SectionHeader title="Scheduling Defaults" desc="Default values applied when creating new shifts and schedules." />
                    <SettingsCard>
                      <Field label="Week Starts On">
                        <select value={form.weekStart} onChange={e => update('weekStart', e.target.value)} className={inputCls}>
                          <option value="sunday">Sunday</option>
                          <option value="monday">Monday</option>
                        </select>
                      </Field>
                      <Field label="Default Shift Duration (hours)">
                        <input type="number" min="1" max="24" value={form.defaultShiftDuration}
                          onChange={e => update('defaultShiftDuration', e.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Weekly Overtime Threshold (hours)">
                        <input type="number" min="1" max="80" value={form.overtimeThreshold}
                          onChange={e => update('overtimeThreshold', e.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Minimum Rest Between Shifts (hours)">
                        <input type="number" min="1" max="24" value={form.minRestHours}
                          onChange={e => update('minRestHours', e.target.value)} className={inputCls} />
                      </Field>
                    </SettingsCard>
                  </>
                )}

                {/* ── Notifications ─────────────────────── */}
                {activeSection === 'notifications' && (
                  <>
                    <SectionHeader title="Notifications" desc="Choose how and when employees and managers are notified." />
                    <SettingsCard>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Channels</p>
                      <Toggle label="Email notifications" desc="Send notifications via email" value={form.emailNotifications} onChange={v => update('emailNotifications', v)} />
                      <Toggle label="SMS notifications" desc="Send notifications via text message" value={form.smsNotifications} onChange={v => update('smsNotifications', v)} />
                      <Toggle label="Slack notifications" desc="Send notifications to Slack" value={form.slackNotifications} onChange={v => update('slackNotifications', v)} />
                      <div className="border-t border-gray-100 my-4" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Events</p>
                      <Toggle label="Schedule published" desc="Notify employees when a new schedule is published" value={form.shiftPublished} onChange={v => update('shiftPublished', v)} />
                      <Toggle label="Shift swap requests" desc="Notify managers when employees request swaps" value={form.shiftSwapRequests} onChange={v => update('shiftSwapRequests', v)} />
                      <Toggle label="Schedule changes" desc="Notify employees when their shift is changed" value={form.scheduleChanges} onChange={v => update('scheduleChanges', v)} />
                    </SettingsCard>
                  </>
                )}

                {/* ── Users & Access ────────────────────── */}
                {activeSection === 'users' && (
                  <>
                    <SectionHeader title="Users & Access" desc="Manage admin and staff accounts. Staff can only view their own schedule." />
                    <SettingsCard>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Invite New User</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InviteUserForm />
                        </div>
                      </div>
                    </SettingsCard>
                    <SettingsCard>
                      <p className="text-xs text-gray-500">
                        <strong className="text-gray-700">Admin</strong> — full access to all schedules, employees, reports, and settings.<br/>
                        <strong className="text-gray-700">Staff</strong> — can only log in and view <em>their own</em> assigned shifts at <code className="bg-gray-100 px-1 rounded">/my-schedule</code>.
                      </p>
                    </SettingsCard>
                  </>
                )}

                {/* ── Security ──────────────────────────── */}
                {activeSection === 'security' && (
                  <>
                    <SectionHeader title="Security & Authentication" desc="Control login security and session settings." />
                    <SettingsCard>
                      <Toggle label="Require MFA for all managers" desc="Enforce two-factor authentication for scheduler and admin roles" value={form.mfaRequired} onChange={v => update('mfaRequired', v)} />
                      <Field label="Session Timeout (hours)">
                        <select value={form.sessionTimeout} onChange={e => update('sessionTimeout', e.target.value)} className={inputCls}>
                          {['1', '4', '8', '24', '48', '168'].map(h => <option key={h} value={h}>{h === '168' ? '7 days' : `${h}h`}</option>)}
                        </select>
                      </Field>
                      <Field label="IP Whitelist" hint="Comma-separated IPs (leave blank to allow all)">
                        <input type="text" placeholder="192.168.1.1, 10.0.0.0/24" value={form.ipWhitelist}
                          onChange={e => update('ipWhitelist', e.target.value)} className={inputCls} />
                      </Field>
                    </SettingsCard>
                  </>
                )}

                {/* ── Integrations ──────────────────────── */}
                {activeSection === 'integrations' && (
                  <>
                    <SectionHeader title="Integrations" desc="Connect TimeSync to your payroll, HRIS, and communication tools." />
                    <div className="space-y-3">
                      {[
                        { name: 'ADP Workforce Now', category: 'Payroll', connected: false, logo: '🏢' },
                        { name: 'Paychex',           category: 'Payroll', connected: false, logo: '💼' },
                        { name: 'QuickBooks',        category: 'Accounting', connected: false, logo: '📊' },
                        { name: 'Slack',             category: 'Messaging', connected: true,  logo: '💬' },
                        { name: 'Microsoft Teams',   category: 'Messaging', connected: false, logo: '🟦' },
                        { name: 'BambooHR',          category: 'HRIS', connected: false, logo: '🎋' },
                        { name: 'Workday',           category: 'HRIS', connected: false, logo: '☁️' },
                      ].map(int => (
                        <div key={int.name} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{int.logo}</span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{int.name}</p>
                              <p className="text-xs text-gray-500">{int.category}</p>
                            </div>
                          </div>
                          <button className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            int.connected
                              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                          )}>
                            {int.connected ? '✓ Connected' : 'Connect'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Appearance ────────────────────────── */}
                {activeSection === 'appearance' && (
                  <>
                    <SectionHeader title="Appearance" desc="Customize the look of your TimeSync workspace." />
                    <SettingsCard>
                      <Field label="Brand Color">
                        <div className="flex items-center gap-3">
                          <input type="color" value={form.primaryColor}
                            onChange={e => update('primaryColor', e.target.value)}
                            className="h-9 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                          <span className="text-sm text-gray-600 font-mono">{form.primaryColor}</span>
                        </div>
                      </Field>
                      <Field label="Preview">
                        <div className="flex gap-2">
                          {['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'].map(c => (
                            <button key={c} onClick={() => update('primaryColor', c)}
                              className={cn('h-7 w-7 rounded-full border-2 transition-all', form.primaryColor === c ? 'border-gray-900 scale-110' : 'border-transparent')}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </Field>
                    </SettingsCard>
                  </>
                )}

                {/* ── Billing ───────────────────────────── */}
                {activeSection === 'billing' && (
                  <>
                    <SectionHeader title="Billing & Plan" desc="Manage your subscription and payment details." />
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/70 mb-0.5">Current Plan</p>
                          <p className="text-xl font-bold">Enterprise</p>
                          <p className="text-sm text-white/80 mt-1">Unlimited employees · All features · Dedicated support</p>
                        </div>
                        <span className="bg-white/20 rounded-lg px-3 py-1 text-sm font-semibold">Active</span>
                      </div>
                    </div>
                    <SettingsCard>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Next billing date</span>
                        <span className="text-sm font-medium text-gray-900">July 1, 2026</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Seats used</span>
                        <span className="text-sm font-medium text-gray-900">12 / Unlimited</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Billing contact</span>
                        <span className="text-sm font-medium text-gray-900">Cadenfahie2005@gmail.com</span>
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex gap-2">
                        <Button variant="secondary" size="sm" className="text-xs">View Invoices</Button>
                        <Button variant="secondary" size="sm" className="text-xs">Update Payment</Button>
                      </div>
                    </SettingsCard>
                  </>
                )}

                {/* Save button — shown for all non-billing, non-integrations sections */}
                {!['billing', 'integrations'].includes(activeSection) && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="primary" size="md" onClick={handleSave} leftIcon={saved ? <Check size={14} /> : undefined}>
                      {saved ? 'Saved!' : 'Save Changes'}
                    </Button>
                    {saved && <span className="text-sm text-green-600 font-medium">Changes saved successfully.</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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
  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
          value ? 'bg-indigo-600' : 'bg-gray-200'
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          value ? 'translate-x-4' : 'translate-x-0'
        )} />
      </button>
    </div>
  );
}
