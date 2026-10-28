'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { setManyShiftAssignments } from '@/lib/db';
import { loadSchedulingContext } from '@/lib/scheduling';
import { autoFill, staffTarget, workHours, type AutoFillResult, type EngineContext } from '@/lib/rule-engine';

interface Props {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  onClose: () => void;
  onApplied: (rows: any[]) => void;
}

// Fills every under-staffed shift in the week using the rule engine, shows a
// preview, and saves only when the admin confirms.
export function AutoScheduleModal({ weekStart, weekEnd, weekLabel, onClose, onApplied }: Props) {
  const { profile } = useAuth();
  const [plan, setPlan]       = useState<AutoFillResult | null>(null);
  const [labels, setLabels]   = useState<Map<string, string>>(new Map());
  const [minStaff, setMinStaff] = useState<Map<string, number>>(new Map());
  const [error, setError]     = useState('');
  const [applying, setApplying] = useState(false);
  const [empNames, setEmpNames] = useState<Map<string, string>>(new Map());
  const [hours, setHours] = useState<{ name: string; hours: number }[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!profile?.orgId) return;
    loadSchedulingContext(profile.orgId, weekStart, weekEnd)
      .then(({ ctx, engineEmployees }) => {
        const targets = ctx.shifts.filter(s =>
          s.date >= weekStart && s.date <= weekEnd &&
          s.assignedEmployeeIds.length < staffTarget(s, ctx.rules));
        setLabels(new Map(ctx.shifts.map(s => [s.id, `${s.title || 'Shift'} · ${fmtDay(s.date)} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`])));
        setMinStaff(new Map(ctx.shifts.map(s => [s.id, s.minStaff ?? 1])));
        const names = new Map(engineEmployees.map(e => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
        setEmpNames(names);
        const result = autoFill(targets, engineEmployees, ctx);
        setPlan(result);
        setHours(weekHoursAfter(ctx, result, weekStart, weekEnd, names));
      })
      .catch(e => setError(e?.message ?? 'Could not load the schedule.'));
  }, [profile?.orgId, weekStart, weekEnd]);

  async function apply() {
    if (!plan) return;
    setApplying(true); setError('');
    try {
      onApplied(await setManyShiftAssignments(plan.changes.map(c => ({ ...c, minStaff: minStaff.get(c.shiftId) ?? 1 }))));
    } catch (e: any) {
      setError(e?.message ?? 'Saving failed part-way. Reload to see what was saved.');
      setApplying(false);
    }
  }

  const nothingToDo = plan && plan.changes.length === 0 && plan.unfilled.length === 0;

  return (
    <Modal title="Auto-Schedule" subtitle={weekLabel} onClose={onClose} size="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>{plan?.changes.length ? 'Cancel' : 'Close'}</Button>
        {plan && plan.changes.length > 0 && (
          <Button variant="ai" size="sm" leftIcon={<Zap size={13} />} onClick={apply} loading={applying}>
            Assign {plan.assignedCount} {plan.assignedCount === 1 ? 'person' : 'people'}
          </Button>
        )}
      </>}>
      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {!plan && !error && (
        <div className="flex flex-col items-center py-10 text-sm text-gray-500 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={22} />
          Checking availability, time off, and your rules…
        </div>
      )}
      {nothingToDo && (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="text-green-500 mb-2" size={26} />
          <p className="text-sm font-medium text-gray-900">Every shift this week is fully staffed.</p>
        </div>
      )}
      {plan && !nothingToDo && (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Only people allowed to do each task are picked. It keeps people in continuous blocks, prefers each
            slot&apos;s usual people, spreads hours fairly, and gives breaks to whoever works through them. Hard rules
            are never broken; soft-rule warnings are avoided when anyone else is free.
          </p>
          {hours.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Hours this week, after assigning</h3>
              <div className="flex flex-wrap gap-1.5">
                {hours.map(h => (
                  <span key={h.name} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {h.name} <span className="font-semibold">{h.hours.toFixed(1)}h</span>
                  </span>
                ))}
              </div>
            </section>
          )}
          {plan.changes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Will assign</h3>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {(showAll ? plan.changes : plan.changes.slice(0, LIST_LIMIT)).map(c => (
                  <li key={c.shiftId} className="px-3 py-2 text-sm flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-900">{labels.get(c.shiftId)}</p>
                      <p className="text-xs text-gray-500">{c.added.map(id => empNames.get(id) ?? 'Employee').join(', ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {!showAll && plan.changes.length > LIST_LIMIT && (
                <button onClick={() => setShowAll(true)} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">
                  Show all {plan.changes.length}
                </button>
              )}
            </section>
          )}
          {plan.unfilled.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Can&apos;t fill</h3>
              <ul className="divide-y divide-gray-100 rounded-lg border border-amber-200 bg-amber-50/40">
                {plan.unfilled.map(u => (
                  <li key={u.shiftId} className="px-3 py-2 text-sm flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-900">{labels.get(u.shiftId)} <span className="text-amber-700">· needs {u.missing} more</span></p>
                      <p className="text-xs text-gray-500">{u.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

const LIST_LIMIT = 60;

// Worked hours per person in the week once the plan is applied (breaks excluded).
function weekHoursAfter(ctx: EngineContext, plan: AutoFillResult, from: string, to: string, names: Map<string, string>) {
  const changed = new Map(plan.changes.map(c => [c.shiftId, c.employeeIds]));
  const totals = new Map<string, number>();
  for (const s of ctx.shifts) {
    if (s.date < from || s.date > to) continue;
    for (const id of changed.get(s.id) ?? s.assignedEmployeeIds) totals.set(id, (totals.get(id) ?? 0) + workHours(ctx, s));
  }
  return [...totals.entries()]
    .map(([id, hours]) => ({ name: names.get(id) ?? 'Employee', hours }))
    .sort((a, b) => b.hours - a.hours);
}

function fmtDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
