'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { createShifts, getEmployees } from '@/lib/db';
import { presetRows } from '@/lib/presets';
import { canDoTask, eligibilityLabel } from '@/lib/rule-engine';
import { parseISODate, toISODate } from '@/lib/dates';
import {
  getSeasons, createSeason, updateSeason, deleteSeason,
  getShiftTemplates, createShiftTemplate, updateShiftTemplate, deleteShiftTemplate,
} from '@/lib/db';
import type { Season, ShiftTemplate, SeasonType, WeeklyAvailability } from '@/types';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Edit2, Loader2, Clock, CalendarDays, Layers, Copy, Coffee,
} from 'lucide-react';

const SEASON_LABELS: Record<SeasonType, string> = {
  fall:               'Fall',
  spring:             'Spring',
  fall_intersession:  'Fall Intersession',
  spring_intersession:'Spring Intersession',
  summer:             'Summer Hours',
  summer_intersession:'Summer Intersession',
};

const SEASON_COLORS: Record<SeasonType, string> = {
  fall:               '#f59e0b',
  spring:             '#10b981',
  fall_intersession:  '#f97316',
  spring_intersession:'#84cc16',
  summer:             '#3b82f6',
  summer_intersession:'#8b5cf6',
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_LABELS: Record<string, string> = { sun: 'Su', mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa' };

const BLANK_HOURS = {
  sun: { start: '', end: '' }, mon: { start: '07:00', end: '22:00' },
  tue: { start: '07:00', end: '22:00' }, wed: { start: '07:00', end: '22:00' },
  thu: { start: '07:00', end: '22:00' }, fri: { start: '07:00', end: '22:00' },
  sat: { start: '10:00', end: '18:00' },
};

const TEMPLATE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const ALL_DAYS = [0,1,2,3,4,5,6];
const WEEKDAYS = [1,2,3,4,5];

// ── Season form modal ─────────────────────────────────────────────────────────

function SeasonModal({ season, onClose, onSaved }: { season?: Season; onClose: () => void; onSaved: (s: Season) => void }) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(season?.name ?? '');
  const [seasonType, setSeasonType] = useState<SeasonType>(season?.seasonType ?? 'fall');
  const [startDate, setStartDate] = useState(season?.startDate ?? '');
  const [endDate, setEndDate] = useState(season?.endDate ?? '');
  const [hours, setHours] = useState(season?.hours ?? BLANK_HOURS);

  function setDayHour(day: string, field: 'start' | 'end', val: string) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day as keyof typeof prev], [field]: val } }));
  }

  function toggleDay(day: string) {
    const isOn = (hours as any)[day].start !== '';
    setHours(prev => ({ ...prev, [day]: isOn ? { start: '', end: '' } : { start: '09:00', end: '17:00' } }));
  }

  async function handleSave() {
    if (!name.trim() || !startDate || !endDate) { setError('Name and date range are required.'); return; }
    if (!profile?.orgId) return;
    setSaving(true); setError('');
    try {
      const payload = { name, seasonType, startDate, endDate, hoursJson: JSON.stringify(hours) };
      let saved: Season;
      if (season) {
        saved = await updateSeason(season.id, payload) as Season;
      } else {
        saved = await createSeason(profile.orgId, payload) as Season;
      }
      onSaved(saved);
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={season ? 'Edit Season' : 'New Season'} onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          {season ? 'Save Changes' : 'Create Season'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelCls}>Season Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Fall 2026" />
        </div>

        <div>
          <label className={labelCls}>Season Type</label>
          <select value={seasonType} onChange={e => setSeasonType(e.target.value as SeasonType)} className={inputCls}>
            {(Object.keys(SEASON_LABELS) as SeasonType[]).map(t => (
              <option key={t} value={t}>{SEASON_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Operating Hours</label>
          <p className="text-xs text-gray-400 mb-2">Leave start empty to mark day as closed.</p>
          <div className="space-y-1.5">
            {DAY_KEYS.map(day => {
              const h = (hours as any)[day];
              const isOpen = h.start !== '';
              return (
                <div key={day} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2', isOpen ? 'bg-indigo-50/50' : 'bg-gray-50')}>
                  <button onClick={() => toggleDay(day)} role="switch" aria-checked={isOpen} aria-label={`Open on ${DAY_LABELS[day]}`} className={cn('relative rounded-full transition-colors flex-shrink-0', isOpen ? 'bg-indigo-500' : 'bg-gray-300')} style={{ height: 16, width: 28 }}>
                    <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all', isOpen ? 'left-[12px]' : 'left-[2px]')} />
                  </button>
                  <span className={cn('w-6 text-xs font-semibold', isOpen ? 'text-gray-700' : 'text-gray-400')}>{DAY_LABELS[day]}</span>
                  {isOpen ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input type="time" value={h.start} onChange={e => setDayHour(day, 'start', e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <span className="text-gray-300 text-xs">–</span>
                      <input type="time" value={h.end} onChange={e => setDayHour(day, 'end', e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Pre-set slot modal ────────────────────────────────────────────────────────

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }
function fromMin(n: number) { return `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }

function TemplateModal({ template, copyOf, seasonId, orgId, defaultDays, onClose, onSaved }: {
  template?: ShiftTemplate; copyOf?: ShiftTemplate; seasonId: string; orgId: string; defaultDays?: number[];
  onClose: () => void; onSaved: (saved: ShiftTemplate[]) => void;
}) {
  const { departments, taskTypes, workerTypes } = useOrgData();
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const base = template ?? copyOf;
  const [taskTypeId, setTaskTypeId] = useState(base?.taskTypeId ?? '');
  const [name, setName] = useState(base?.name ?? '');
  const [startTime, setStartTime] = useState(base?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(base?.endTime ?? '12:00');
  const [color, setColor] = useState(base?.color ?? TEMPLATE_COLORS[0]);
  const [departmentId, setDepartmentId] = useState(base?.departmentId ?? '');
  const [minStaff, setMinStaff] = useState(base?.minStaff ?? 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(base?.daysOfWeek ?? defaultDays ?? WEEKDAYS);
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [preferred, setPreferred] = useState<string[]>(base?.preferredEmployeeIds ?? []);
  const [blockMinutes, setBlockMinutes] = useState(0);   // 0 = one slot

  useEffect(() => { getEmployees(orgId).then(setEmployees).catch(() => {}); }, [orgId]);

  const task = taskTypes.find(t => t.id === taskTypeId);
  const eligible = employees.filter(e => canDoTask(task, e));

  function pickTask(id: string) {
    const next = taskTypes.find(t => t.id === id);
    if (next && (!name.trim() || name === task?.name)) setName(next.name);
    if (next) setColor(next.color);
    setTaskTypeId(id);
    setPreferred(p => p.filter(pid => canDoTask(next, employees.find(e => e.id === pid) ?? { id: pid })));
  }

  function toggleDow(d: number) {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  // Splitting 08:00–21:00 into 60-minute blocks makes 13 back-to-back slots,
  // the usual way a rotating desk is staffed.
  const blocks = (() => {
    const start = toMin(startTime);
    let end = toMin(endTime);
    if (end <= start) end += 1440;
    if (!blockMinutes || template) return [[startTime, endTime]];
    const out: [string, string][] = [];
    for (let t = start; t < end; t += blockMinutes) out.push([fromMin(t), fromMin(Math.min(t + blockMinutes, end))]);
    return out;
  })();

  async function handleSave() {
    const finalName = name.trim() || task?.name || '';
    if (!finalName) { setError('Pick a task or enter a name.'); return; }
    if (daysOfWeek.length === 0) { setError('Select at least one day.'); return; }
    if (blocks.length > 48) { setError('That makes more than 48 slots. Use longer blocks.'); return; }
    setSaving(true); setError('');
    try {
      const deptName = departments.find(d => d.id === departmentId)?.name ?? '';
      const payload = {
        name: finalName, color, departmentId: departmentId || undefined, departmentName: deptName || undefined,
        minStaff, daysOfWeek, notes: notes || undefined, taskTypeId: taskTypeId || undefined, preferredEmployeeIds: preferred,
      };
      if (template) {
        // Task fields are only sent when set or being cleared (they need the tasks migration).
        const taskPatch = {
          ...(taskTypeId || template.taskTypeId ? { taskTypeId: taskTypeId || null } : {}),
          ...(preferred.length || template.preferredEmployeeIds.length ? { preferredEmployeeIds: preferred } : {}),
        };
        onSaved([await updateShiftTemplate(template.id, {
          ...payload, taskTypeId: undefined, preferredEmployeeIds: undefined, ...taskPatch, startTime, endTime, notes: notes || '',
        }) as ShiftTemplate]);
      } else {
        const saved: ShiftTemplate[] = [];
        for (const [a, b] of blocks) saved.push(await createShiftTemplate(orgId, { seasonId, ...payload, startTime: a, endTime: b }) as ShiftTemplate);
        onSaved(saved);
      }
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={template ? 'Edit slot' : copyOf ? 'Duplicate slot' : 'New pre-set slot'} subtitle="A task at a fixed time on certain days" onClose={onClose} size="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          {template ? 'Save changes' : blocks.length > 1 ? `Create ${blocks.length} slots` : 'Create slot'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="slot-task">Task</label>
            <select id="slot-task" value={taskTypeId} onChange={e => pickTask(e.target.value)} className={inputCls}>
              <option value="">No task (anyone)</option>
              {taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}{t.isBreak ? ' (break)' : ''}</option>)}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              {task ? <>Who: {eligibilityLabel(task, workerTypes)}</> : <a href="/settings?section=tasks" className="text-indigo-600 hover:underline">Manage tasks</a>}
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="slot-name">Label</label>
            <input id="slot-name" value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder={task?.name ?? 'e.g. Morning Reference'} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="slot-start">Start</label>
            <input id="slot-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="slot-end">End</label>
            <input id="slot-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="slot-people">People needed</label>
            <input id="slot-people" type="number" min="1" max="50" value={minStaff} onChange={e => setMinStaff(Math.max(1, Number(e.target.value)))} className={inputCls} />
          </div>
        </div>

        {!template && (
          <div>
            <label className={labelCls} htmlFor="slot-blocks">Split into back-to-back slots</label>
            <select id="slot-blocks" value={blockMinutes} onChange={e => setBlockMinutes(Number(e.target.value))} className={inputCls}>
              <option value={0}>No — one slot</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={90}>Every 90 minutes</option>
              <option value={120}>Every 2 hours</option>
              <option value={240}>Every 4 hours</option>
            </select>
            {blocks.length > 1 && <p className="text-[11px] text-gray-500 mt-1">{blocks.length} slots: {blocks.slice(0, 4).map(b => b.join('–')).join(', ')}{blocks.length > 4 ? ', …' : ''}</p>}
          </div>
        )}

        <div>
          <span className={labelCls}>Days of week</span>
          <div className="flex gap-1.5 mt-1">
            {ALL_DAYS.map(d => (
              <button key={d} type="button" onClick={() => toggleDow(d)} aria-pressed={daysOfWeek.includes(d)} className={cn(
                'w-9 h-9 rounded-lg text-xs font-semibold transition-all border',
                daysOfWeek.includes(d)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              )}>
                {DOW_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>Usually worked by (optional)</span>
          <p className="text-[11px] text-gray-500 mb-1.5">Auto-Schedule picks these people first when they&apos;re free.</p>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
            {eligible.length === 0 && <p className="p-3 text-xs text-gray-500">No eligible employees.</p>}
            {eligible.map(e => (
              <label key={e.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={preferred.includes(e.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  onChange={() => setPreferred(p => p.includes(e.id) ? p.filter(x => x !== e.id) : [...p, e.id])} />
                <span className="flex-1">{e.firstName} {e.lastName}</span>
                <span className="text-xs text-gray-400">{workerTypes.find(w => w.id === e.workerTypeId)?.name ?? ''}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="slot-dept">Department</label>
            <select id="slot-dept" value={departmentId} onChange={e => setDepartmentId(e.target.value)} className={inputCls}>
              <option value="">No department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelCls}>Color</span>
            <div className="flex gap-1.5 mt-1.5">
              {TEMPLATE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Use color ${c}`} aria-pressed={color === c}
                  className={cn('h-6 w-6 rounded-full transition-all', color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="slot-notes">Notes (optional)</label>
          <textarea id="slot-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Instructions for whoever works this slot" />
        </div>
      </div>
    </Modal>
  );
}

// ── Generate modal ────────────────────────────────────────────────────────────

function GenerateModal({ season, templates, orgId, onClose, onGenerated }: {
  season: Season; templates: ShiftTemplate[]; orgId: string; onClose: () => void; onGenerated: (count: number) => void;
}) {
  const { addToast } = useAppStore();
  const { taskTypes } = useOrgData();
  const [startDate, setStartDate] = useState(season.startDate);
  const [endDate, setEndDate] = useState(season.endDate);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!startDate || !endDate) return;
    setGenerating(true);
    try {
      // Each row carries its template id, so re-running a range skips
      // slots that already exist.
      const rows = presetRows(orgId, templates, taskTypes, startDate, endDate);
      const count = await createShifts(rows);
      const skipped = rows.length - count;
      onGenerated(count);
      addToast({
        type: 'success',
        title: `Generated ${count} shift${count === 1 ? '' : 's'}`,
        message: skipped > 0 ? `${skipped} already existed and were skipped.` : `${startDate} → ${endDate}`,
      });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Generation failed', message: e?.message });
    } finally {
      setGenerating(false);
      onClose();
    }
  }

  const activeTemplates = templates.filter(t => t.isActive);

  return (
    <Modal title="Generate shifts from the pre-set" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="ai" size="sm" onClick={handleGenerate} loading={generating}>
          {generating ? 'Generating…' : `Generate Shifts`}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
          <p className="font-semibold mb-1">Season: {season.name}</p>
          <p>{activeTemplates.length} active slot{activeTemplates.length !== 1 ? 's' : ''} across {new Set(activeTemplates.map(t => t.name)).size} task{new Set(activeTemplates.map(t => t.name)).size !== 1 ? 's' : ''}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={season.startDate} max={season.endDate} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={season.startDate} max={season.endDate} className={inputCls} />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          This creates an unassigned shift for every slot on each matching day. Then open the Schedule and use
          Auto-Schedule (or the AI Copilot) to assign staff and students week by week — only people allowed to do
          each task are picked. Slots that already exist are skipped.
        </p>
      </div>
    </Modal>
  );
}

// ── Pre-set day table ─────────────────────────────────────────────────────────

function PresetDayTable({ templates, day, onDayChange, deletingId, onEdit, onDuplicate, onDelete }: {
  templates: ShiftTemplate[]; day: number; onDayChange: (d: number) => void; deletingId: string | null;
  onEdit: (t: ShiftTemplate) => void; onDuplicate: (t: ShiftTemplate) => void; onDelete: (t: ShiftTemplate) => void;
}) {
  const { taskTypes, workerTypes } = useOrgData();
  const [taskFilter, setTaskFilter] = useState('');
  const tasks = new Map(taskTypes.map(t => [t.id, t]));
  const rows = templates
    .filter(t => t.daysOfWeek.includes(day) && (!taskFilter || t.taskTypeId === taskFilter))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name));
  const perDay = ALL_DAYS.map(d => templates.filter(t => t.isActive && t.daysOfWeek.includes(d)).length);
  const peopleHours = rows.reduce((sum, t) => {
    if (tasks.get(t.taskTypeId ?? '')?.isBreak) return sum;
    let mins = toMin(t.endTime) - toMin(t.startTime);
    if (mins <= 0) mins += 1440;
    return sum + (mins / 60) * t.minStaff;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Day of week" className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {ALL_DAYS.map(d => (
            <button key={d} role="tab" aria-selected={day === d} onClick={() => onDayChange(d)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                day === d ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>
              {DOW_LABELS[d]} <span className={cn('ml-0.5', day === d ? 'text-indigo-200' : 'text-gray-400')}>{perDay[d]}</span>
            </button>
          ))}
        </div>
        <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} aria-label="Filter by task"
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs">
          <option value="">All tasks</option>
          {taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-500">{rows.length} slots · {peopleHours.toFixed(1)} staff-hours</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing pre-set on this day.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5 text-center">People</th>
                <th className="px-4 py-2.5">Days</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(t => {
                const task = tasks.get(t.taskTypeId ?? '');
                return (
                  <tr key={t.id} className={cn('group hover:bg-gray-50/60', !t.isActive && 'opacity-50')}>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-700">{t.startTime}–{t.endTime}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="truncate font-medium text-gray-900">{t.name}</span>
                        {task?.isBreak && <Coffee size={12} className="text-amber-500 shrink-0" aria-label="Break" />}
                      </div>
                      {t.preferredEmployeeIds.length > 0 && (
                        <p className="text-[11px] text-gray-400 pl-4">{t.preferredEmployeeIds.length} usual {t.preferredEmployeeIds.length === 1 ? 'person' : 'people'}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{task ? eligibilityLabel(task, workerTypes) : 'Anyone'}</td>
                    <td className="px-4 py-2 text-center text-gray-700">{t.minStaff}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-0.5">
                        {ALL_DAYS.map(d => (
                          <span key={d} className={cn('w-4 text-center text-[9px] font-semibold rounded', t.daysOfWeek.includes(d) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-300')}>
                            {DOW_LABELS[d][0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => onEdit(t)} aria-label={`Edit ${t.name} ${t.startTime}`} className="p-1 rounded text-gray-400 hover:text-indigo-600"><Edit2 size={13} /></button>
                        <button onClick={() => onDuplicate(t)} aria-label={`Duplicate ${t.name} ${t.startTime}`} className="p-1 rounded text-gray-400 hover:text-indigo-600"><Copy size={13} /></button>
                        <button onClick={() => onDelete(t)} disabled={deletingId === t.id} aria-label={`Delete ${t.name} ${t.startTime}`} className="p-1 rounded text-gray-400 hover:text-red-500">
                          {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeasonsPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | undefined>();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | undefined>();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [presetDay, setPresetDay] = useState(1);
  const [duplicateFrom, setDuplicateFrom] = useState<ShiftTemplate | undefined>();

  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    getSeasons(profile.orgId)
      .then(setSeasons)
      .catch(() => addToast({ type: 'error', title: 'Failed to load seasons' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  useEffect(() => {
    if (!selectedSeason || !profile?.orgId) return;
    setLoadingTemplates(true);
    getShiftTemplates(profile.orgId, selectedSeason.id)
      .then(setTemplates)
      .catch(() => addToast({ type: 'error', title: 'Failed to load the pre-set' }))
      .finally(() => setLoadingTemplates(false));
  }, [selectedSeason?.id, profile?.orgId]);

  async function handleDeleteSeason(s: Season) {
    if (!(await confirmDialog({ title: `Delete season "${s.name}"?`, message: 'Its pre-set slots are deleted too. Shifts already generated stay on the schedule.', confirmLabel: 'Delete', danger: true }))) return;
    setDeletingId(s.id);
    try {
      await deleteSeason(s.id);
      setSeasons(prev => prev.filter(x => x.id !== s.id));
      if (selectedSeason?.id === s.id) setSelectedSeason(null);
      addToast({ type: 'success', title: 'Season deleted' });
    } catch { addToast({ type: 'error', title: 'Failed to delete' }); }
    finally { setDeletingId(null); }
  }

  async function handleDeleteTemplate(t: ShiftTemplate) {
    if (!(await confirmDialog({ title: `Delete "${t.name}"?`, message: 'Shifts already generated from it stay on the schedule.', confirmLabel: 'Delete', danger: true }))) return;
    setDeletingId(t.id);
    try {
      await deleteShiftTemplate(t.id);
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      addToast({ type: 'success', title: 'Slot deleted' });
    } catch { addToast({ type: 'error', title: 'Failed to delete' }); }
    finally { setDeletingId(null); }
  }

  const seasonTemplates = selectedSeason ? templates : [];

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Seasons & Pre-set Schedules"
          subtitle="Seasonal hours and the fixed task slots Auto-Schedule fills"
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs" onClick={() => { setEditingSeason(undefined); setShowSeasonModal(true); }}>
              New Season
            </Button>
          }
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Season list */}
          <div className={cn('w-full md:w-72 border-r border-gray-200 bg-white flex-col', selectedSeason ? 'hidden md:flex' : 'flex')}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Seasons</h2>
              <span className="text-xs text-gray-400">{seasons.length}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center flex-1 gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : seasons.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                <CalendarDays size={32} className="text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-medium">No seasons yet</p>
                <p className="text-xs text-gray-400 mt-1">Create a season to define operating hours and its pre-set schedule.</p>
                <Button variant="primary" size="sm" className="mt-4 text-xs" leftIcon={<Plus size={12} />} onClick={() => setShowSeasonModal(true)}>
                  New Season
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {seasons.map(s => {
                  const color = SEASON_COLORS[s.seasonType] ?? '#6366f1';
                  const isSelected = selectedSeason?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedSeason(s)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSeason(s); } }}
                      className={cn(
                        'w-full text-left rounded-xl px-3 py-2.5 transition-all group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                        isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                          <div className="min-w-0">
                            <p className={cn('text-sm font-semibold truncate', isSelected ? 'text-indigo-700' : 'text-gray-800')}>{s.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{s.startDate} → {s.endDate}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); setEditingSeason(s); setShowSeasonModal(true); }} aria-label={`Edit ${s.name}`} className="p-1 text-gray-400 hover:text-indigo-600">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteSeason(s); }} disabled={deletingId === s.id} aria-label={`Delete ${s.name}`} className="p-1 text-gray-400 hover:text-red-500">
                            {deletingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {DAY_KEYS.map(d => {
                          const h = s.hours[d];
                          return (
                            <span key={d} className={cn('text-[9px] px-1 rounded', h.start ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>
                              {DAY_LABELS[d]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Templates panel */}
          <div className={cn('flex-1 flex-col overflow-hidden', selectedSeason ? 'flex' : 'hidden md:flex')}>
            {!selectedSeason ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
                <Layers size={40} className="text-gray-200 mb-4" />
                <p className="text-sm text-gray-500 font-medium">Select a season to manage its pre-set schedule</p>
                <p className="text-xs text-gray-400 mt-1">A pre-set is the weekly pattern of task slots that generates your schedule.</p>
              </div>
            ) : (
              <>
                {/* Templates header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-gray-100 bg-white">
                  <div className="min-w-0">
                    <button onClick={() => setSelectedSeason(null)} className="md:hidden mb-1 text-xs font-medium text-indigo-600">← All seasons</button>
                    <h2 className="text-sm font-bold text-gray-900">{selectedSeason.name} — Pre-set schedule</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{SEASON_LABELS[selectedSeason.seasonType]} · {selectedSeason.startDate} to {selectedSeason.endDate}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="text-xs" leftIcon={<Clock size={12} />}
                      onClick={() => setShowGenerateModal(true)}>
                      Generate Shifts
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
                      onClick={() => { setEditingTemplate(undefined); setShowTemplateModal(true); }}>
                      New slot
                    </Button>
                  </div>
                </div>

                {/* Hours summary */}
                <div className="px-6 py-3 bg-white border-b border-gray-50">
                  <div className="flex gap-3 flex-wrap">
                    {DAY_KEYS.map(d => {
                      const h = selectedSeason.hours[d];
                      return (
                        <div key={d} className={cn('text-xs rounded-lg px-2.5 py-1.5 flex items-center gap-1.5', h.start ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400')}>
                          <span className="font-semibold">{DAY_LABELS[d]}</span>
                          {h.start ? <span>{h.start}–{h.end}</span> : <span>Closed</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pre-set slots, one weekday at a time */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Loading pre-set…</span>
                    </div>
                  ) : seasonTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Clock size={36} className="text-gray-200 mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No pre-set schedule for this season</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        Add slots — a task at a fixed time on certain days, e.g. &ldquo;Desk 8–9 AM, Mon–Fri, 2 people&rdquo;.
                        Slots may overlap. Auto-Schedule then assigns staff and students who are allowed to do each task.
                      </p>
                      <Button variant="primary" size="sm" className="mt-4 text-xs" leftIcon={<Plus size={12} />}
                        onClick={() => { setEditingTemplate(undefined); setShowTemplateModal(true); }}>
                        Add first slot
                      </Button>
                    </div>
                  ) : (
                    <PresetDayTable
                      templates={seasonTemplates}
                      day={presetDay}
                      onDayChange={setPresetDay}
                      deletingId={deletingId}
                      onEdit={t => { setEditingTemplate(t); setShowTemplateModal(true); }}
                      onDuplicate={t => { setEditingTemplate(undefined); setDuplicateFrom(t); setShowTemplateModal(true); }}
                      onDelete={handleDeleteTemplate}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showSeasonModal && (
        <SeasonModal
          season={editingSeason}
          onClose={() => setShowSeasonModal(false)}
          onSaved={saved => {
            if (editingSeason) {
              setSeasons(prev => prev.map(s => s.id === saved.id ? saved : s));
              if (selectedSeason?.id === saved.id) setSelectedSeason(saved);
            } else {
              setSeasons(prev => [...prev, saved]);
            }
            setShowSeasonModal(false);
          }}
        />
      )}

      {showTemplateModal && selectedSeason && profile?.orgId && (
        <TemplateModal
          template={editingTemplate}
          copyOf={duplicateFrom}
          seasonId={selectedSeason.id}
          orgId={profile.orgId}
          defaultDays={[presetDay]}
          onClose={() => { setShowTemplateModal(false); setDuplicateFrom(undefined); }}
          onSaved={saved => {
            setTemplates(prev => {
              const byId = new Map(prev.map(t => [t.id, t]));
              for (const t of saved) byId.set(t.id, t);
              return [...byId.values()].sort((x, y) => x.startTime.localeCompare(y.startTime) || x.name.localeCompare(y.name));
            });
            setShowTemplateModal(false);
            setDuplicateFrom(undefined);
          }}
        />
      )}

      {showGenerateModal && selectedSeason && profile?.orgId && (
        <GenerateModal
          season={selectedSeason}
          templates={seasonTemplates}
          orgId={profile.orgId}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={count => {}}
        />
      )}
    </div>
    </AuthGuard>
  );
}
