'use client';

import { useMemo, useState } from 'react';
import { X, Clock, MapPin, Users, ListChecks, Coffee, AlertCircle, AlertTriangle, CheckCircle2, Ban, UserPlus, Search, Loader2 } from 'lucide-react';
import type { Shift } from '@/types';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatShiftTime, formatHours } from '@/lib/utils';
import { parseISODate } from '@/lib/dates';
import { useAuth } from '@/context/auth-context';
import { useAppStore } from '@/store';
import { setShiftAssignments } from '@/lib/db';
import { loadSchedulingContext, toEngineShift } from '@/lib/scheduling';
import { useOrgData } from '@/lib/org-data';
import { checkAssignment, eligibilityLabel, worstSeverity, staffTarget, type Conflict, type EngineContext, type EngineEmployee } from '@/lib/rule-engine';

interface ShiftDetailPanelProps {
  shift: Shift;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShiftUpdated: (row: any) => void;
}

interface Candidate { emp: EngineEmployee; conflicts: Conflict[]; level: 'ok' | 'warn' | 'block' }

export function ShiftDetailPanel({ shift, onClose, onEdit, onDelete, onShiftUpdated }: ShiftDetailPanelProps) {
  const { profile } = useAuth();
  const { addToast } = useAppStore();
  const { taskTypes, workerTypes } = useOrgData();
  const task = taskTypes.find(t => t.id === shift.taskTypeId);
  const color = shift.color ?? '#6366f1';
  const assignedIds = shift.assignedEmployeeIds ?? shift.assignments.map(a => a.employeeId);
  const assignedNames = shift.assignedEmployeeNames ?? [];

  const [picking, setPicking]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState<string | null>(null);
  const [ctx, setCtx]           = useState<EngineContext | null>(null);
  const [employees, setEmployees] = useState<EngineEmployee[]>([]);
  const [query, setQuery]       = useState('');
  const [confirmWarn, setConfirmWarn] = useState<string | null>(null);

  const target = ctx ? staffTarget(toEngineShift(shift), ctx.rules) : shift.minStaff;
  const coverage = assignedIds.length / Math.max(1, target);

  async function openPicker() {
    if (!profile?.orgId) return;
    setPicking(true); setLoading(true);
    try {
      const data = await loadSchedulingContext(profile.orgId, shift.date, shift.date);
      setCtx(data.ctx);
      setEmployees(data.engineEmployees);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not load staff', message: e?.message });
      setPicking(false);
    } finally {
      setLoading(false);
    }
  }

  const candidates: Candidate[] = useMemo(() => {
    if (!ctx) return [];
    // Judge against this shift as it is now, not as it was when ctx loaded.
    const current = toEngineShift(shift);
    const live: EngineContext = { ...ctx, shifts: [...ctx.shifts.filter(s => s.id !== shift.id), current] };
    const q = query.trim().toLowerCase();
    return employees
      .filter(e => !assignedIds.includes(e.id))
      .filter(e => !q || `${e.firstName} ${e.lastName} ${e.role ?? ''}`.toLowerCase().includes(q))
      .map(emp => {
        const conflicts = checkAssignment(current, emp, live);
        return { emp, conflicts, level: worstSeverity(conflicts) };
      })
      .sort((a, b) => rank(a.level) - rank(b.level) || a.emp.lastName.localeCompare(b.emp.lastName));
  }, [ctx, employees, shift, query]);

  async function save(ids: string[], names: string[], key: string, toast: string) {
    setSaving(key);
    try {
      const row = await setShiftAssignments(shift.id, ids, names, shift.minStaff);
      onShiftUpdated(row);
      addToast({ type: 'success', title: toast });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not update assignment', message: e?.message });
    } finally {
      setSaving(null); setConfirmWarn(null);
    }
  }

  function assign(c: Candidate) {
    if (c.level === 'block') return;
    if (c.level === 'warn' && confirmWarn !== c.emp.id) { setConfirmWarn(c.emp.id); return; }
    const name = `${c.emp.firstName} ${c.emp.lastName}`.trim();
    save([...assignedIds, c.emp.id], [...assignedNames, name], c.emp.id, `${name} assigned`);
  }

  function unassign(employeeId: string) {
    const idx = assignedIds.indexOf(employeeId);
    const name = assignedNames[idx] ?? 'Employee';
    save(assignedIds.filter((_, i) => i !== idx), assignedNames.filter((_, i) => i !== idx), employeeId, `${name} removed`);
  }

  return (
    <aside aria-label="Shift details" className="fixed inset-0 z-40 flex flex-col w-full bg-white sm:static sm:z-auto sm:w-80 sm:border-l sm:border-gray-200 h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-4 border-b border-gray-100"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {shift.department?.name || 'Shift'}
            </p>
          </div>
          <h2 className="text-base font-bold text-gray-900 truncate">{shift.title ?? 'Shift'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {parseISODate(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close shift details"
          className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Shift info */}
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <InfoRow icon={<Clock size={14} className="text-gray-400" />}>
            <span className="text-sm font-medium text-gray-900">{formatShiftTime(shift.startTime, shift.endTime)}</span>
            <span className="text-xs text-gray-500 ml-1">({formatHours(shift.durationHours)})</span>
          </InfoRow>
          {task && (
            <InfoRow icon={task.isBreak ? <Coffee size={14} className="text-amber-500" /> : <ListChecks size={14} className="text-gray-400" />}>
              <span className="text-sm text-gray-900">{task.name}</span>
              <span className="text-xs text-gray-500 ml-1">· {eligibilityLabel(task, workerTypes)}</span>
            </InfoRow>
          )}
          {shift.location?.name && (
            <InfoRow icon={<MapPin size={14} className="text-gray-400" />}>
              <span className="text-sm text-gray-900">{shift.location.name}</span>
            </InfoRow>
          )}
          <InfoRow icon={<Users size={14} className="text-gray-400" />}>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 rounded-full bg-gray-100 h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, coverage * 100)}%`,
                  backgroundColor: coverage >= 1 ? '#22c55e' : coverage >= 0.5 ? '#eab308' : '#ef4444',
                }} />
              </div>
              <span className="text-xs font-medium text-gray-700">{assignedIds.length}/{target} staffed</span>
            </div>
          </InfoRow>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={assignedIds.length < target ? 'warning' : 'success'}>
              {assignedIds.length < target ? 'Needs staff' : 'Fully staffed'}
            </Badge>
            <Badge variant="default">{shift.shiftType}</Badge>
            {shift.crossesMidnight && <Badge variant="purple">Overnight</Badge>}
          </div>
        </div>

        {/* Assigned */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned</h3>
            {!picking && (
              <Button variant="primary" size="sm" leftIcon={<UserPlus size={12} />} className="text-xs" onClick={openPicker}>
                Assign
              </Button>
            )}
          </div>
          {assignedIds.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-800">No one assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shift.assignments.map(a => (
                <div key={a.id} className="flex items-center gap-2.5">
                  <Avatar firstName={a.employee?.firstName ?? '?'} lastName={a.employee?.lastName ?? ''}
                    color={a.employee?.displayColor} size="sm" />
                  <p className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                    {a.employee?.firstName} {a.employee?.lastName}
                  </p>
                  <button onClick={() => unassign(a.employeeId)} disabled={saving !== null}
                    aria-label={`Remove ${a.employee?.firstName ?? 'employee'} from shift`}
                    className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
                    {saving === a.employeeId ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Picker */}
        {picking && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add someone</h3>
              <button onClick={() => { setPicking(false); setConfirmWarn(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Done</button>
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search staff…"
                className="w-full rounded-lg border border-gray-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-indigo-500" /></div>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center">
                {employees.length === 0 ? 'No employees yet — add them on the Employees page.' : 'Everyone is already assigned.'}
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                {candidates.map(c => (
                  <li key={c.emp.id}>
                    <button onClick={() => assign(c)} disabled={c.level === 'block' || saving !== null}
                      className={cn('w-full text-left rounded-lg border px-2.5 py-2 transition-colors',
                        c.level === 'ok' && 'border-gray-200 hover:border-green-300 hover:bg-green-50',
                        c.level === 'warn' && (confirmWarn === c.emp.id ? 'border-amber-400 bg-amber-50' : 'border-amber-200 hover:bg-amber-50'),
                        c.level === 'block' && 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-75')}>
                      <div className="flex items-center gap-2">
                        {c.level === 'ok' && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                        {c.level === 'warn' && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                        {c.level === 'block' && <Ban size={14} className="text-red-400 shrink-0" />}
                        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{c.emp.firstName} {c.emp.lastName}</span>
                        {saving === c.emp.id && <Loader2 size={13} className="animate-spin text-indigo-500" />}
                        {c.level === 'ok' && saving !== c.emp.id && <span className="text-[10px] font-semibold text-green-600">Available</span>}
                      </div>
                      {c.conflicts.length > 0 && (
                        <ul className="mt-1 ml-[22px] space-y-0.5">
                          {c.conflicts.map((x, i) => (
                            <li key={i} className={cn('text-[11px] leading-snug', x.severity === 'block' ? 'text-red-600' : 'text-amber-700')}>
                              {x.message}{x.ruleName ? <span className="text-gray-400"> · {x.ruleName}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                      {confirmWarn === c.emp.id && (
                        <p className="mt-1.5 ml-[22px] text-[11px] font-semibold text-amber-800">Click again to assign anyway.</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {shift.notes && (
          <div className="px-4 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Notes</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{shift.notes}</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onEdit}>Edit Shift</Button>
        <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </aside>
  );
}

const rank = (l: 'ok' | 'warn' | 'block') => (l === 'ok' ? 0 : l === 'warn' ? 1 : 2);

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="flex items-center gap-1.5 flex-1">{children}</div>
    </div>
  );
}
