'use client';

import { useState } from 'react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { RULE_PARAMS } from '@/lib/rule-engine';
import { useOrgData } from '@/lib/org-data';

interface Props { onClose: () => void; onSaved: (rule: any) => void; }

// Only rule types the rule engine actually checks (lib/rule-engine.ts).
const RULE_TYPES = [
  { value: 'MAX_HOURS_WEEK',       label: 'Max hours per week',            group: 'Hours',    desc: 'Caps each person\'s scheduled hours in a Sunday–Saturday week.' },
  { value: 'MAX_HOURS_DAY',        label: 'Max hours per day',             group: 'Hours',    desc: 'Caps each person\'s scheduled hours in a single day.' },
  { value: 'MIN_REST_BETWEEN',     label: 'Minimum rest between shifts',   group: 'Hours',    desc: 'Required gap between the end of one shift and the start of the next.' },
  { value: 'MAX_CONSECUTIVE_DAYS', label: 'Max consecutive working days',  group: 'Hours',    desc: 'Longest run of days in a row someone can be scheduled.' },
  { value: 'MINIMIZE_OVERTIME',    label: 'Overtime threshold',            group: 'Hours',    desc: 'Flags assignments that push someone past this many hours in a week.' },
  { value: 'MIN_STAFFING',         label: 'Minimum people per shift',      group: 'Staffing', desc: 'Auto-Schedule fills shifts up to at least this many people.' },
  { value: 'MAX_STAFFING',         label: 'Maximum people per shift',      group: 'Staffing', desc: 'Stops a shift from getting more people than this.' },
  { value: 'PREFER_AVAILABILITY',  label: 'Respect employee availability', group: 'People',   desc: 'Checks each person\'s weekly availability and day-off overrides.' },
  { value: 'BALANCE_WEEKENDS',     label: 'Balance weekend shifts',        group: 'People',   desc: 'Auto-Schedule spreads weekend shifts across people.' },
];

export function NewRuleModal({ onClose, onSaved }: Props) {
  const { departments } = useOrgData();
  const [form, setForm] = useState({
    ruleType: 'MAX_HOURS_WEEK', constraintType: 'hard' as 'hard' | 'soft',
    name: '', description: '', value: String(RULE_PARAMS.MAX_HOURS_WEEK.defaultValue), priority: '50', departmentId: '',
  });
  const [error, setError] = useState('');
  const type = RULE_TYPES.find(t => t.value === form.ruleType)!;
  const meta = RULE_PARAMS[form.ruleType];

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function pickType(ruleType: string) {
    const m = RULE_PARAMS[ruleType];
    setForm(p => ({ ...p, ruleType, value: m ? String(m.defaultValue) : '' }));
  }

  function handleSave() {
    const n = Number(form.value);
    if (meta && (!Number.isFinite(n) || n <= 0)) { setError(`${meta.label} must be a positive number.`); return; }
    const name = form.name.trim() || (meta ? `${type.label}: ${n} ${meta.unit}` : type.label);
    onSaved({
      name,
      ruleType: form.ruleType,
      constraintType: form.constraintType,
      description: form.description.trim() || type.desc,
      priority: parseInt(form.priority),
      isEnabled: true,
      isSystem: false,
      weight: form.constraintType === 'soft' ? 0.7 : undefined,
      conditions: [],
      parameters: meta ? { [meta.key]: n } : {},
      scopeDepts: form.departmentId ? [form.departmentId] : [],
      createdAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <Modal title="New Scheduling Rule" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" leftIcon={<ShieldCheck size={13} />} onClick={handleSave}>Create Rule</Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className={labelCls}>Rule</label>
          <select value={form.ruleType} onChange={e => pickType(e.target.value)} className={inputCls}>
            {['Hours', 'Staffing', 'People'].map(g => (
              <optgroup key={g} label={g}>
                {RULE_TYPES.filter(r => r.group === g).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5">{type.desc}</p>
        </div>

        {meta && (
          <div>
            <label className={labelCls}>{meta.label}</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={form.value} onChange={e => set('value', e.target.value)} className={inputCls + ' w-28'} />
              <span className="text-sm text-gray-500">{meta.unit}</span>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>When broken</label>
          <div className="grid grid-cols-2 gap-2">
            {(['hard', 'soft'] as const).map(t => (
              <button key={t} onClick={() => setForm(p => ({ ...p, constraintType: t }))}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.constraintType === t
                    ? t === 'hard' ? 'border-red-400 bg-red-50 text-red-700 ring-1 ring-red-300'
                                   : 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {t === 'hard' ? '🔒 Block the assignment' : '⚠️ Warn, but allow'}
              </button>
            ))}
          </div>
        </div>

        {departments.length > 0 && (
          <div>
            <label className={labelCls}>Applies to</label>
            <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)} className={inputCls}>
              <option value="">All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} only</option>)}
            </select>
          </div>
        )}

        <div><label className={labelCls}>Name (optional)</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder={meta ? `${type.label}: ${form.value || '…'} ${meta.unit}` : type.label} className={inputCls} /></div>

        <div><label className={labelCls}>Description (optional)</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} placeholder={type.desc} className={inputCls + ' resize-none'} /></div>
      </div>
    </Modal>
  );
}
