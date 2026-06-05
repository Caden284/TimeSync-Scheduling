'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, getContrastColor } from '@/lib/utils';
import { saveSetup, getNextColor } from '@/lib/org-store';
import type { StaffMember, DeptData, LocationData } from '@/lib/org-store';
import {
  Zap, Building2, MapPin, Users, Check, ChevronRight,
  ChevronLeft, Plus, Trash2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const VERTICALS = [
  { id: 'healthcare',    label: 'Healthcare',     emoji: '🏥' },
  { id: 'library',       label: 'Library',        emoji: '📚' },
  { id: 'university',    label: 'University',     emoji: '🎓' },
  { id: 'restaurant',    label: 'Restaurant',     emoji: '🍽️' },
  { id: 'retail',        label: 'Retail',         emoji: '🛒' },
  { id: 'warehouse',     label: 'Warehouse',      emoji: '📦' },
  { id: 'government',    label: 'Government',     emoji: '🏛️' },
  { id: 'security',      label: 'Security',       emoji: '🛡️' },
  { id: 'events',        label: 'Events',         emoji: '🎪' },
  { id: 'manufacturing', label: 'Manufacturing',  emoji: '🏭' },
  { id: 'nonprofit',     label: 'Nonprofit',      emoji: '❤️' },
  { id: 'call_center',   label: 'Call Center',    emoji: '📞' },
  { id: 'hotel',         label: 'Hotel',          emoji: '🏨' },
  { id: 'airline',       label: 'Airline',        emoji: '✈️' },
  { id: 'construction',  label: 'Construction',   emoji: '🏗️' },
  { id: 'other',         label: 'Other',          emoji: '🏢' },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
  'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

const COLORS = ['#6366f1','#ef4444','#f97316','#22c55e','#06b6d4','#8b5cf6','#ec4899','#f59e0b'];

const EMPLOYMENT_TYPES = [
  { value: 'full_time',  label: 'Full-Time' },
  { value: 'part_time',  label: 'Part-Time' },
  { value: 'per_diem',   label: 'Per Diem'  },
];

// ── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: Building2, label: 'Organization' },
  { id: 2, icon: MapPin,    label: 'Locations'    },
  { id: 3, icon: Users,     label: 'Team'         },
  { id: 4, icon: Check,     label: 'Review'       },
];

// ── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — Org
  const [orgName, setOrgName]       = useState('');
  const [vertical, setVertical]     = useState('');
  const [timezone, setTimezone]     = useState('America/New_York');
  const [primaryColor, setPrimary]  = useState('#6366f1');

  // Step 2 — Departments & Locations
  const [departments, setDepartments] = useState<DeptData[]>([
    { id: 'dept-1', name: '', color: '#6366f1' },
  ]);
  const [locations, setLocations] = useState<LocationData[]>([
    { id: 'loc-1', name: '', city: '', state: '' },
  ]);

  // Step 3 — Staff
  const [staff, setStaff] = useState<StaffMember[]>([
    { id: 'emp-1', firstName: '', lastName: '', email: '', role: '', department: '', employmentType: 'full_time', payRate: '', phone: '', color: '#6366f1' },
  ]);

  const canProceed1 = orgName.trim().length >= 2 && vertical !== '';
  const canProceed2 = departments.some(d => d.name.trim()) && locations.some(l => l.name.trim());
  const canProceed3 = staff.some(s => s.firstName.trim() && s.lastName.trim());

  function addDept() {
    setDepartments(prev => [...prev, { id: `dept-${Date.now()}`, name: '', color: getNextColor(prev.length) }]);
  }
  function removeDept(id: string) {
    setDepartments(prev => prev.filter(d => d.id !== id));
  }
  function updateDept(id: string, key: keyof DeptData, value: string) {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d));
  }

  function addLocation() {
    setLocations(prev => [...prev, { id: `loc-${Date.now()}`, name: '', city: '', state: '' }]);
  }
  function removeLocation(id: string) {
    setLocations(prev => prev.filter(l => l.id !== id));
  }
  function updateLocation(id: string, key: keyof LocationData, value: string) {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
  }

  function addStaff() {
    const idx = staff.length;
    setStaff(prev => [...prev, {
      id: `emp-${Date.now()}`, firstName: '', lastName: '', email: '',
      role: '', department: departments.find(d => d.name)?.name ?? '',
      employmentType: 'full_time', payRate: '', phone: '',
      color: getNextColor(idx),
    }]);
  }
  function removeStaff(id: string) {
    setStaff(prev => prev.filter(s => s.id !== id));
  }
  function updateStaff(id: string, key: keyof StaffMember, value: string) {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));
  }

  function handleFinish() {
    const filledDepts  = departments.filter(d => d.name.trim());
    const filledLocs   = locations.filter(l => l.name.trim());
    const filledStaff  = staff.filter(s => s.firstName.trim() && s.lastName.trim());

    saveSetup({
      org: {
        name: orgName.trim(),
        vertical,
        timezone,
        primaryColor,
        logoInitials: orgName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      },
      departments: filledDepts,
      locations:   filledLocs,
      staff:       filledStaff,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    });
    router.push('/schedule');
  }

  const logoFg = getContrastColor(primaryColor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: primaryColor }}>
            <Zap size={20} style={{ color: logoFg }} />
          </div>
          <span className="text-xl font-bold text-white">TimeSync Scheduling</span>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active  = step === s.id;
            const done    = step > s.id;
            return (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' :
                  done   ? 'bg-green-500/20 text-green-400' :
                           'bg-white/10 text-white/40'
                )}>
                  {done ? <Check size={12} /> : <Icon size={12} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-px w-8 mx-1', step > s.id ? 'bg-green-400' : 'bg-white/10')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* ── Step 1: Organization ──────────────────────────────── */}
          {step === 1 && (
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Set up your organization</h1>
              <p className="text-gray-500 text-sm mb-6">Tell us about your workplace so we can tailor TimeSync for you.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Organization / Business Name *</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="e.g. Riverside Medical Center"
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Industry *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {VERTICALS.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVertical(v.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl border py-2 px-1 text-center transition-all',
                          vertical === v.id
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <span className="text-lg">{v.emoji}</span>
                        <span className="text-[9px] font-medium text-gray-700 leading-tight">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Timezone</label>
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Brand Color</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setPrimary(c)}
                          className={cn('h-7 w-7 rounded-full border-2 transition-all', primaryColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <Button variant="primary" size="lg" onClick={() => setStep(2)} disabled={!canProceed1} rightIcon={<ChevronRight size={16} />}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Departments & Locations ──────────────────── */}
          {step === 2 && (
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Departments & Locations</h1>
              <p className="text-gray-500 text-sm mb-6">Add where your team works and how it's organized. You can always add more later.</p>

              {/* Departments */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Departments</label>
                  <button onClick={addDept} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {departments.map((dept, i) => (
                    <div key={dept.id} className="flex items-center gap-2">
                      <input type="color" value={dept.color}
                        onChange={e => updateDept(dept.id, 'color', e.target.value)}
                        className="h-8 w-8 rounded-lg border border-gray-200 p-0.5 cursor-pointer shrink-0" />
                      <input type="text" value={dept.name}
                        onChange={e => updateDept(dept.id, 'name', e.target.value)}
                        placeholder={`Department ${i + 1} (e.g. Emergency Dept)`}
                        className={cn(inputCls, 'flex-1')} />
                      {departments.length > 1 && (
                        <button onClick={() => removeDept(dept.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Locations / Sites</label>
                  <button onClick={addLocation} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {locations.map((loc, i) => (
                    <div key={loc.id} className="grid grid-cols-5 gap-2 items-center">
                      <input type="text" value={loc.name}
                        onChange={e => updateLocation(loc.id, 'name', e.target.value)}
                        placeholder={`Site name (e.g. Main Campus)`}
                        className={cn(inputCls, 'col-span-3')} />
                      <input type="text" value={loc.city}
                        onChange={e => updateLocation(loc.id, 'city', e.target.value)}
                        placeholder="City"
                        className={inputCls} />
                      <div className="flex items-center gap-1">
                        <input type="text" value={loc.state}
                          onChange={e => updateLocation(loc.id, 'state', e.target.value)}
                          placeholder="State"
                          className={inputCls} />
                        {locations.length > 1 && (
                          <button onClick={() => removeLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button variant="secondary" size="md" onClick={() => setStep(1)} leftIcon={<ChevronLeft size={14} />}>Back</Button>
                <Button variant="primary" size="lg" onClick={() => setStep(3)} disabled={!canProceed2} rightIcon={<ChevronRight size={16} />}>Continue</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Team members ──────────────────────────────── */}
          {step === 3 && (
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Add your team</h1>
              <p className="text-gray-500 text-sm mb-2">Add the people you'll be scheduling. You can import or add more from the Employees page at any time.</p>
              <p className="text-xs text-indigo-600 font-medium mb-5">💡 Tip: Add at least 3–5 people to see the scheduler in action.</p>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {staff.map((member, i) => (
                  <div key={member.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: member.color }}>
                        {(member.firstName[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-gray-700">Employee {i + 1}</span>
                      {staff.length > 1 && (
                        <button onClick={() => removeStaff(member.id)} className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={member.firstName} onChange={e => updateStaff(member.id, 'firstName', e.target.value)}
                        placeholder="First name *" className={inputCls} />
                      <input type="text" value={member.lastName} onChange={e => updateStaff(member.id, 'lastName', e.target.value)}
                        placeholder="Last name *" className={inputCls} />
                      <input type="email" value={member.email} onChange={e => updateStaff(member.id, 'email', e.target.value)}
                        placeholder="Email address" className={inputCls} />
                      <input type="text" value={member.role} onChange={e => updateStaff(member.id, 'role', e.target.value)}
                        placeholder="Job title / role" className={inputCls} />
                      <select value={member.department} onChange={e => updateStaff(member.id, 'department', e.target.value)} className={inputCls}>
                        <option value="">Department</option>
                        {departments.filter(d => d.name).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={member.employmentType} onChange={e => updateStaff(member.id, 'employmentType', e.target.value as any)} className={inputCls}>
                          {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input type="text" value={member.payRate} onChange={e => updateStaff(member.id, 'payRate', e.target.value)}
                          placeholder="$/hr" className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addStaff}
                className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={14} /> Add another team member
              </button>

              <div className="flex justify-between mt-6">
                <Button variant="secondary" size="md" onClick={() => setStep(2)} leftIcon={<ChevronLeft size={14} />}>Back</Button>
                <Button variant="primary" size="lg" onClick={() => setStep(4)} disabled={!canProceed3} rightIcon={<ChevronRight size={16} />}>Review</Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Launch ───────────────────────────── */}
          {step === 4 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="h-16 w-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-bold text-white shadow-xl"
                  style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}>
                  {orgName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{orgName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {VERTICALS.find(v => v.id === vertical)?.emoji} {VERTICALS.find(v => v.id === vertical)?.label} · {timezone}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <SummaryCard label="Departments" value={departments.filter(d => d.name).length} icon="🏢" />
                <SummaryCard label="Locations" value={locations.filter(l => l.name).length} icon="📍" />
                <SummaryCard label="Team Members" value={staff.filter(s => s.firstName).length} icon="👥" />
              </div>

              {/* Staff preview */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Team</p>
                <div className="space-y-2">
                  {staff.filter(s => s.firstName).map(s => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: s.color }}>
                        {s.firstName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] text-gray-500">{s.role || 'No role'} · {s.department || 'No dept'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Sparkles size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                <p className="text-xs text-indigo-700 leading-relaxed">
                  <strong>You're all set!</strong> TimeSync will load with your team data. Head to the Schedule page to build your first schedule, or the Employees page to add more detail.
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" size="md" onClick={() => setStep(3)} leftIcon={<ChevronLeft size={14} />}>Back</Button>
                <Button variant="primary" size="lg" onClick={handleFinish} leftIcon={<Zap size={16} />}>
                  Launch TimeSync →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Skip for demo */}
        <p className="text-center mt-4 text-xs text-white/40">
          Already have a setup?{' '}
          <button onClick={() => window.location.href = '/schedule'} className="text-white/60 hover:text-white underline">
            Go to app →
          </button>
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
