'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';
import { updateEmployee, deleteEmployee } from '@/lib/db';
import { loadSetup } from '@/lib/org-store';

interface Props { employee: any; onClose: () => void; onSaved: (emp: any) => void; onDeleted: (id: string) => void; }

export function EditEmployeeModal({ employee, onClose, onSaved, onDeleted }: Props) {
  const setup = loadSetup();
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
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await updateEmployee(employee.id ?? employee.$id, {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        role: form.role, departmentId: form.departmentId,
        employmentType: form.employmentType,
        payRate: form.payRate ? parseFloat(form.payRate) : undefined,
      });
      onSaved({ ...employee, ...form, payRate: form.payRate ? parseFloat(form.payRate) : undefined });
      onClose();
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteEmployee(employee.id ?? employee.$id);
      onDeleted(employee.id ?? employee.$id);
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
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
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
    </Modal>
  );
}
