'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Shift } from '@/types';
import { loadSetup } from '@/lib/org-store';

interface NewShiftModalProps {
  defaultDate?: string;
  onSave: (shift: Omit<Shift, 'id' | 'orgId' | 'assignments' | 'metadata' | 'createdAt' | 'startDatetime' | 'endDatetime' | 'durationHours' | 'crossesMidnight'>) => void;
  onClose: () => void;
}

const SHIFT_TYPES = [
  { value: 'fixed',     label: 'Fixed',    desc: 'Set start and end times' },
  { value: 'open',      label: 'Open',     desc: 'Available for self-pickup' },
  { value: 'overnight', label: 'Overnight',desc: 'Crosses midnight' },
  { value: 'split',     label: 'Split',    desc: 'Two segments in one day' },
];

const COLORS = ['#6366f1','#ef4444','#f97316','#22c55e','#06b6d4','#8b5cf6','#f59e0b','#ec4899','#14b8a6'];

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';

export function NewShiftModal({ defaultDate, onSave, onClose }: NewShiftModalProps) {
  const setup = loadSetup();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title:        '',
    date:         defaultDate ?? today,
    startTime:    '07:00',
    endTime:      '15:00',
    shiftType:    'fixed' as Shift['shiftType'],
    departmentId: setup?.departments[0]?.id ?? '',
    roleId:       '',
    locationId:   setup?.locations[0]?.id ?? '',
    minStaff:     '1',
    maxStaff:     '',
    isOpen:       false,
    notes:        '',
    color:        '#6366f1',
  });

  function update(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const dept = setup?.departments.find(d => d.id === form.departmentId);
    const loc  = setup?.locations.find(l => l.id === form.locationId);
    onSave({
      scheduleId:   'sched-1',
      templateId:   undefined,
      departmentId: form.departmentId || undefined,
      roleId:       form.roleId       || undefined,
      locationId:   form.locationId   || undefined,
      date:         form.date,
      startTime:    form.startTime + ':00',
      endTime:      form.endTime   + ':00',
      breakMinutes: 0,
      shiftType:    form.shiftType,
      status:       form.isOpen ? 'open' : 'scheduled',
      isOpen:       form.isOpen,
      minStaff:     Number(form.minStaff) || 1,
      maxStaff:     form.maxStaff ? Number(form.maxStaff) : undefined,
      requiredSkills: [],
      requiredCerts:  [],
      title:          form.title || undefined,
      notes:          form.notes || undefined,
      color:          form.color,
      department:     dept ? { id: dept.id, name: dept.name, color: dept.color, orgId: 'local', isActive: true } : undefined,
      location:       loc  ? { id: loc.id,  name: loc.name,  orgId: 'local', isActive: true } : undefined,
    });
    onClose();
  }

  const isValid = form.date && form.startTime && form.endTime;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.color + '20' }}>
              <Plus size={16} style={{ color: form.color }} />
            </div>
            <h2 className="text-base font-bold text-gray-900">New Shift</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Shift type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Shift Type</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIFT_TYPES.map(t => (
                <button key={t.value} onClick={() => {
                  update('shiftType', t.value);
                  if (t.value === 'open') update('isOpen', true);
                  else update('isOpen', false);
                }}
                  className={cn(
                    'text-left rounded-lg border px-3 py-2 transition-all',
                    form.shiftType === t.value
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className="text-xs font-semibold text-gray-900">{t.label}</p>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Shift Title</label>
            <input type="text" value={form.title} onChange={e => update('title', e.target.value)}
              placeholder="e.g. Morning Shift, Day Nurse, Cashier..." className={inputCls} autoFocus />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date *</label>
              <input type="date" value={form.date} onChange={e => update('date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start *</label>
              <input type="time" value={form.startTime} onChange={e => update('startTime', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">End *</label>
              <input type="time" value={form.endTime} onChange={e => update('endTime', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Dept + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Department</label>
              <select value={form.departmentId} onChange={e => update('departmentId', e.target.value)} className={inputCls}>
                <option value="">No department</option>
                {setup?.departments.filter(d => d.name).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Location</label>
              <select value={form.locationId} onChange={e => update('locationId', e.target.value)} className={inputCls}>
                <option value="">No location</option>
                {setup?.locations.filter(l => l.name).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Min staff */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Min Staff Needed</label>
              <input type="number" min="1" max="100" value={form.minStaff}
                onChange={e => update('minStaff', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Max Staff (optional)</label>
              <input type="number" min="1" max="100" value={form.maxStaff}
                onChange={e => update('maxStaff', e.target.value)} placeholder="No limit" className={inputCls} />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => update('color', c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all', form.color === c ? 'border-gray-800 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
              rows={2} placeholder="Any special instructions for this shift…"
              className={cn(inputCls, 'resize-none')} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!isValid}
            leftIcon={<Plus size={13} />}>
            Create Shift
          </Button>
        </div>
      </div>
    </div>
  );
}
