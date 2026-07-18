'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

interface Props { onClose: () => void; onSaved: (rule: any) => void; }

const RULE_TYPES = [
  { value: 'MIN_STAFFING',        label: 'Minimum Staffing',       group: 'Staffing' },
  { value: 'MAX_STAFFING',        label: 'Maximum Staffing',       group: 'Staffing' },
  { value: 'MAX_HOURS_DAY',       label: 'Max Hours Per Day',      group: 'Hours' },
  { value: 'MAX_HOURS_WEEK',      label: 'Max Hours Per Week',     group: 'Hours' },
  { value: 'MIN_REST_BETWEEN',    label: 'Minimum Rest Between Shifts', group: 'Hours' },
  { value: 'MAX_CONSECUTIVE_DAYS',label: 'Max Consecutive Days',   group: 'Hours' },
  { value: 'REQUIRE_CERT',        label: 'Require Certification',  group: 'Qualifications' },
  { value: 'REQUIRE_SKILL',       label: 'Require Skill',          group: 'Qualifications' },
  { value: 'BREAK_REQUIREMENT',   label: 'Break Requirement',      group: 'Compliance' },
  { value: 'PREFER_AVAILABILITY', label: 'Prefer Available Staff', group: 'Soft' },
  { value: 'BALANCE_HOURS',       label: 'Balance Hours Evenly',   group: 'Soft' },
  { value: 'MINIMIZE_OVERTIME',   label: 'Minimize Overtime',      group: 'Soft' },
];

export function NewRuleModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: '', ruleType: 'MIN_STAFFING', constraintType: 'hard' as 'hard' | 'soft',
    description: '', value: '', priority: '50',
  });
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function handleSave() {
    if (!form.name) return;
    onSaved({
      id: `rule-${Date.now()}`,
      name: form.name,
      ruleType: form.ruleType,
      constraintType: form.constraintType,
      description: form.description,
      priority: parseInt(form.priority),
      isEnabled: true,
      parameters: form.value ? { value: form.value } : {},
    });
    onClose();
  }

  return (
    <Modal title="New Scheduling Rule" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<ShieldCheck size={13} />} onClick={handleSave} disabled={!form.name}>
          Create Rule
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Constraint Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['hard', 'soft'] as const).map(t => (
              <button key={t} onClick={() => set('constraintType', t)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all capitalize ${
                  form.constraintType === t
                    ? t === 'hard' ? 'border-red-400 bg-red-50 text-red-700 ring-1 ring-red-300'
                                   : 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {t === 'hard' ? '🔒 Hard (must obey)' : '⚖️ Soft (try to obey)'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {form.constraintType === 'hard'
              ? 'Hard rules are never violated — the schedule won\'t generate if they can\'t be met.'
              : 'Soft rules are optimization goals — violated only when necessary.'}
          </p>
        </div>

        <div><label className={labelCls}>Rule Type</label>
          <select value={form.ruleType} onChange={e => set('ruleType', e.target.value)} className={inputCls}>
            {['Staffing', 'Hours', 'Qualifications', 'Compliance', 'Soft'].map(g => (
              <optgroup key={g} label={g}>
                {RULE_TYPES.filter(r => r.group === g).map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div><label className={labelCls}>Rule Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Minimum 2 librarians per shift" className={inputCls} autoFocus /></div>

        <div><label className={labelCls}>Value / Threshold</label>
          <input value={form.value} onChange={e => set('value', e.target.value)}
            placeholder="e.g. 2 (for minimum staff), 40 (for max weekly hours)" className={inputCls} /></div>

        <div><label className={labelCls}>Description (optional)</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} placeholder="When and why this rule applies…"
            className={inputCls + ' resize-none'} /></div>

        <div><label className={labelCls}>Priority (1 = lowest, 100 = highest)</label>
          <input type="range" min="1" max="100" value={form.priority}
            onChange={e => set('priority', e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span><span className="font-semibold text-indigo-600">{form.priority}</span><span>High</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
