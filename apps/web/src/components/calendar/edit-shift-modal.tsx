'use client';

import { useState } from 'react';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatTime } from '@/lib/utils';
import type { Shift } from '@/types';
import { mockDepartments, mockRoles, mockLocations } from '@/lib/mock-data';

interface EditShiftModalProps {
  shift: Shift;
  mode: 'edit' | 'delete';
  onSave: (updated: Partial<Shift>) => void;
  onDelete: (shiftId: string) => void;
  onClose: () => void;
}

export function EditShiftModal({ shift, mode, onSave, onDelete, onClose }: EditShiftModalProps) {
  const [form, setForm] = useState({
    title:        shift.title ?? '',
    date:         shift.date,
    startTime:    shift.startTime.slice(0, 5),   // "07:00"
    endTime:      shift.endTime.slice(0, 5),
    departmentId: shift.departmentId ?? '',
    roleId:       shift.roleId ?? '',
    locationId:   shift.locationId ?? '',
    minStaff:     String(shift.minStaff),
    notes:        shift.notes ?? '',
    color:        shift.color ?? '#6366f1',
  });

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave({
      title:        form.title || undefined,
      date:         form.date,
      startTime:    form.startTime + ':00',
      endTime:      form.endTime + ':00',
      departmentId: form.departmentId || undefined,
      roleId:       form.roleId || undefined,
      locationId:   form.locationId || undefined,
      minStaff:     Number(form.minStaff),
      notes:        form.notes || undefined,
      color:        form.color,
    });
    onClose();
  }

  // ── Delete confirmation ──────────────────────────────────────
  if (mode === 'delete') {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Delete Shift</h2>
              <p className="text-xs text-gray-500">This cannot be undone</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-2">
            Are you sure you want to delete <strong>{shift.title ?? 'this shift'}</strong>?
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {shift.date} · {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            {shift.assignments.length > 0 && (
              <span className="block mt-1 text-amber-600 font-medium">
                ⚠️ This shift has {shift.assignments.length} employee{shift.assignments.length > 1 ? 's' : ''} assigned — they will be notified.
              </span>
            )}
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { onDelete(shift.id); onClose(); }} leftIcon={<Trash2 size={13} />}>
              Delete Shift
            </Button>
          </div>
        </div>
      </Backdrop>
    );
  }

  // ── Edit form ────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Edit Shift</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">

          {/* Title */}
          <FormField label="Shift Title">
            <input type="text" value={form.title} onChange={e => update('title', e.target.value)}
              placeholder="e.g. ICU Day Shift" className={inputCls} />
          </FormField>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Date">
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="Start Time">
              <input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="End Time">
              <input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} className={inputCls} />
            </FormField>
          </div>

          {/* Dept + Role */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Department">
              <select value={form.departmentId} onChange={e => update('departmentId', e.target.value)} className={inputCls}>
                <option value="">Select department</option>
                {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Role">
              <select value={form.roleId} onChange={e => update('roleId', e.target.value)} className={inputCls}>
                <option value="">Select role</option>
                {mockRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FormField>
          </div>

          {/* Location + Min Staff */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Location">
              <select value={form.locationId} onChange={e => update('locationId', e.target.value)} className={inputCls}>
                <option value="">Select location</option>
                {mockLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
            <FormField label="Min Staff Required">
              <input type="number" min="1" max="50" value={form.minStaff}
                onChange={e => update('minStaff', e.target.value)} className={inputCls} />
            </FormField>
          </div>

          {/* Color */}
          <FormField label="Color">
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={e => update('color', e.target.value)}
                className="h-9 w-16 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
              <div className="flex gap-2">
                {['#6366f1','#ef4444','#f97316','#22c55e','#06b6d4','#8b5cf6','#f59e0b'].map(c => (
                  <button key={c} onClick={() => update('color', c)}
                    className={cn('h-6 w-6 rounded-full border-2 transition-all', form.color === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </FormField>

          {/* Notes */}
          <FormField label="Notes">
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
              rows={3} placeholder="Any instructions for this shift…"
              className={cn(inputCls, 'resize-none')} />
          </FormField>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} leftIcon={<Save size={13} />}>
            Save Changes
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
