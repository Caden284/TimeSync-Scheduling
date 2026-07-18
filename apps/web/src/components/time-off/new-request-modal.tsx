'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { createTimeOffRequest } from '@/lib/db';

interface Props { onClose: () => void; onSaved: (req: any) => void; employees?: any[]; }

const LEAVE_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Bereavement', 'Jury Duty', 'FMLA', 'Other'];

export function NewRequestModal({ onClose, onSaved, employees = [] }: Props) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeId: profile?.employeeId ?? '',
    employeeName: profile ? `${profile.firstName} ${profile.lastName}` : '',
    leaveType: 'Vacation',
    startDate: '', endDate: '', reason: '',
  });
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.startDate || !form.endDate) { setError('Start and end dates are required.'); return; }
    if (!form.employeeName) { setError('Employee name is required.'); return; }
    setSaving(true); setError('');
    try {
      const doc = await createTimeOffRequest({
        orgId: profile?.orgId ?? 'local',
        employeeId: form.employeeId,
        employeeName: form.employeeName,
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
      });
      onSaved({ id: doc.$id, ...form, status: 'pending', submittedAt: new Date().toISOString().split('T')[0], hours: 8 });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit request.');
    } finally { setSaving(false); }
  }

  return (
    <Modal title="New Time Off Request" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<Send size={13} />} onClick={handleSave} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {employees.length > 0 ? (
          <div><label className={labelCls}>Employee</label>
            <select value={form.employeeId} onChange={e => {
              const emp = employees.find(x => x.id === e.target.value);
              set('employeeId', e.target.value);
              if (emp) set('employeeName', `${emp.firstName} ${emp.lastName}`);
            }} className={inputCls}>
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>
        ) : (
          <div><label className={labelCls}>Employee Name</label>
            <input value={form.employeeName} onChange={e => set('employeeName', e.target.value)} className={inputCls} /></div>
        )}

        <div><label className={labelCls}>Leave Type</label>
          <select value={form.leaveType} onChange={e => set('leaveType', e.target.value)} className={inputCls}>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Start Date *</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>End Date *</label>
            <input type="date" value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} className={inputCls} /></div>
        </div>

        <div><label className={labelCls}>Reason (optional)</label>
          <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
            rows={3} placeholder="Brief description…" className={inputCls + ' resize-none'} /></div>
      </div>
    </Modal>
  );
}
