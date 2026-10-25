'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';
import { updateEmployee, deleteEmployee, updateEmployeeAvailability } from '@/lib/db';
import { loadSetup } from '@/lib/org-store';
import { cn } from '@/lib/utils';
import type { WeeklyAvailability } from '@/types';

interface Props { employee: any; onClose: () => void; onSaved: (emp: any) => void; onDeleted: (id: string) => void; }

const DAYS: { key: keyof WeeklyAvailability; label: string }[] = [
  { key: 'sun', label: 'Sunday' },
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
];

const BLANK_AVAIL: WeeklyAvailability = {
  sun: { start: '', end: '' }, mon: { start: '08:00', end: '17:00' },
  tue: { start: '08:00', end: '17:00' }, wed: { start: '08:00', end: '17:00' },
  thu: { start: '08:00', end: '17:00' }, fri: { start: '08:00', end: '17:00' },
  sat: { start: '', end: '' },
};

function parseAvailability(raw?: Partial<WeeklyAvailability> | null): WeeklyAvailability {
  if (!raw || Object.keys(raw).length === 0) return BLANK_AVAIL;
  return { ...BLANK_AVAIL, ...raw };
}

export function EditEmployeeModal({ employee, onClose, onSaved, onDeleted }: Props) {
  const setup = loadSetup();
  const [tab, setTab] = useState<'info' | 'availability'>('info');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: employee.firstName ?? '',
    lastName:  employee.lastName  ?? '',
    email:     employee.email     ?? '',
    phone:     employee.phone     ?? '',
    role:      employee.role ?? employee.primaryRole?.name ?? '',
    departmentId: employee.departmentId ?? employee.primaryDept?.id ?? '',
    employmentType: employee.employmentType ?? 'full_time',
    payRate: employee.payRate ? String(employee.payRate) : '',
  });
  const [avail, setAvail] = useState<WeeklyAvailability>(
    parseAvailability(employee.weeklyAvailability)
  );
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function setDay(day: keyof WeeklyAvailability, field: 'start' | 'end', val: string) {
    setAvail(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));
  }

  function toggleDay(day: keyof WeeklyAvailability) {
    const isOn = avail[day].start !== '';
    setAvail(prev => ({
      ...prev,
      [day]: isOn
        ? { start: '', end: '' }
        : { start: '08:00', end: '17:00' },
    }));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const empId = employee.id;
      await updateEmployee(empId, {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        phone: form.phone, role: form.role, departmentId: form.departmentId,
        employmentType: form.employmentType,
        payRate: form.payRate ? parseFloat(form.payRate) : undefined,
      });
      await updateEmployeeAvailability(empId, avail);
      onSaved({ ...employee, ...form, payRate: form.payRate ? parseFloat(form.payRate) : undefined, weeklyAvailability: avail });
      onClose();
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteEmployee(employee.id);
      onDeleted(employee.id);
      onClose();
    } catch (e: any) { setError(e?.message ?? 'Delete failed.'); setSaving(false); }
  }

  if (confirmDelete) return (
    <Modal title="Remove Employee" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
          {saving ? 'Removing…' : 'Yes, Remove'}
        </Button>
      </>}>
      <p className="text-sm text-gray-700">Remove <strong>{form.firstName} {form.lastName}</strong> from the system? This will deactivate their account.</p>
    </Modal>
  );

  return (
    <Modal title="Edit Employee" subtitle={`${employee.firstName} ${employee.lastName}`} onClose={onClose}
      footer={<>
        <button onClick={() => setConfirmDelete(true)} className="mr-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
          <Trash2 size={12} /> Remove
        </button>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<Save size={13} />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </>}>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 -mt-1">
        {(['info', 'availability'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'info' ? 'Profile' : 'Availability'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {tab === 'info' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>First Name</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Last Name</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Job Title / Role</label>
            <input value={form.role} onChange={e => set('role', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Department</label>
            <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)} className={inputCls}>
              <option value="">No department</option>
              {setup?.departments.filter(d => d.name).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Employment Type</label>
              <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} className={inputCls}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="per_diem">Per Diem</option>
              </select>
            </div>
            <div><label className={labelCls}>Pay Rate ($/hr)</label>
              <input type="number" min="0" step="0.01" value={form.payRate} onChange={e => set('payRate', e.target.value)} className={inputCls} /></div>
          </div>
        </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 mb-3">Set recurring weekly availability. Toggle a day off to mark it as unavailable.</p>
          {DAYS.map(({ key, label }) => {
            const isOn = avail[key].start !== '';
            return (
              <div key={key} className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isOn ? 'bg-indigo-50/60' : 'bg-gray-50'
              )}>
                <button
                  onClick={() => toggleDay(key)}
                  className={cn(
                    'relative w-8 h-4.5 rounded-full transition-colors flex-shrink-0',
                    isOn ? 'bg-indigo-500' : 'bg-gray-300'
                  )}
                  style={{ height: 18, width: 32 }}
                >
                  <span className={cn(
                    'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all',
                    isOn ? 'left-[14px]' : 'left-[2px]'
                  )} />
                </button>
                <span className={cn('w-20 text-xs font-medium', isOn ? 'text-gray-700' : 'text-gray-400')}>{label}</span>
                {isOn ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={avail[key].start}
                      onChange={e => setDay(key, 'start', e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                      type="time"
                      value={avail[key].end}
                      onChange={e => setDay(key, 'end', e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
