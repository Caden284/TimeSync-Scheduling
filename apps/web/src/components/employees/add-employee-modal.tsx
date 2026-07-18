'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { createEmployee } from '@/lib/db';
import { loadSetup } from '@/lib/org-store';

interface Props { onClose: () => void; onSaved: (emp: any) => void; }

export function AddEmployeeModal({ onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const setup = loadSetup();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    role: '', departmentId: '', employmentType: 'full_time', payRate: '',
  });
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.firstName || !form.lastName) { setError('First and last name are required.'); return; }
    setSaving(true); setError('');
    try {
      const orgId = profile?.orgId ?? 'local';
      const dept = setup?.departments.find(d => d.id === form.departmentId);
      const doc = await createEmployee(orgId, {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        role: form.role, departmentId: form.departmentId,
        employmentType: form.employmentType,
        payRate: form.payRate ? parseFloat(form.payRate) : undefined,
      });
      onSaved({
        id: doc.$id, firstName: form.firstName, lastName: form.lastName, email: form.email,
        role: form.role, departmentId: form.departmentId,
        departmentName: dept?.name ?? '', employmentType: form.employmentType,
        payRate: form.payRate ? parseFloat(form.payRate) : undefined,
        isActive: true, orgId,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Check Appwrite connection.');
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Add Employee" subtitle="New team member" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<UserPlus size={13} />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Add Employee'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>First Name *</label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inputCls} autoFocus /></div>
          <div><label className={labelCls}>Last Name *</label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Phone</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Job Title / Role</label>
          <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Reference Librarian" className={inputCls} /></div>
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
            <input type="number" min="0" step="0.01" value={form.payRate} onChange={e => set('payRate', e.target.value)} placeholder="0.00" className={inputCls} /></div>
        </div>
      </div>
    </Modal>
  );
}
