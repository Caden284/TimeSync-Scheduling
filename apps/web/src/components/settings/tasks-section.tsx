'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Pencil, Coffee, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { createTaskType, deleteTaskType, getEmployees, updateTaskType } from '@/lib/db';
import { eligibilityLabel } from '@/lib/rule-engine';
import { cn } from '@/lib/utils';
import type { TaskType } from '@/types';
import { COLORS, Field, SectionHeader, SettingsCard, inputCls } from './parts';

// Tasks are what pre-set slots are for (Desk, Shipping, Equipment Audit, …)
// and decide who Auto-Schedule may put on them.
export function TasksSection() {
  const { addToast } = useAppStore();
  const { profile } = useAuth();
  const { taskTypes, workerTypes, refresh } = useOrgData();
  const [employees, setEmployees] = useState<any[]>([]);
  const [editing, setEditing] = useState<TaskType | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (profile?.orgId) getEmployees(profile.orgId).then(setEmployees).catch(() => {});
  }, [profile?.orgId]);

  async function remove(t: TaskType) {
    if (!(await confirmDialog({
      title: `Delete ${t.name}?`,
      message: 'Pre-set slots and shifts for this task keep their times but lose the task and its limits.',
      confirmLabel: 'Delete', danger: true,
    }))) return;
    setBusy(t.id);
    try { await deleteTaskType(t.id); await refresh(); }
    catch (e: any) { addToast({ type: 'error', title: 'Could not delete task', message: e?.message }); }
    finally { setBusy(null); }
  }

  const shown = taskTypes.filter(t => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <SectionHeader title="Tasks"
        desc="What each pre-set slot is for, and who may work it. Auto-Schedule only assigns people who are allowed to do the task." />
      <SettingsCard>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks"
              aria-label="Search tasks" className={cn(inputCls, 'pl-8')} />
          </div>
          <Button variant="primary" size="sm" onClick={() => setEditing('new')} leftIcon={<Plus size={13} />}>New task</Button>
        </div>
        {taskTypes.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tasks yet. Add the jobs your pre-set schedule is made of, e.g. &ldquo;Front Desk&rdquo; for anyone and
            &ldquo;Outgoing Shipment&rdquo; for Staff only.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 -mx-1">
            {shown.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-1 py-2.5">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate flex items-center gap-1.5">
                    {t.name}
                    {t.isBreak && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Coffee size={10} /> Break</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">Who: {eligibilityLabel(t, workerTypes)}</p>
                </div>
                <button onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={14} /></button>
                <button onClick={() => remove(t)} disabled={busy !== null} aria-label={`Delete ${t.name}`}
                  className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {busy === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      {editing && (
        <TaskModal task={editing === 'new' ? null : editing} employees={employees}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }} />
      )}
    </>
  );
}

function TaskModal({ task, employees, onClose, onSaved }: {
  task: TaskType | null; employees: any[]; onClose: () => void; onSaved: () => void;
}) {
  const { addToast } = useAppStore();
  const { profile } = useAuth();
  const { workerTypes, taskTypes } = useOrgData();
  const [form, setForm] = useState({
    name: task?.name ?? '',
    description: task?.description ?? '',
    color: task?.color ?? COLORS[taskTypes.length % COLORS.length],
    isBreak: task?.isBreak ?? false,
    allowedWorkerTypeIds: task?.allowedWorkerTypeIds ?? [],
    allowedEmployeeIds: task?.allowedEmployeeIds ?? [],
  });
  const [peopleQuery, setPeopleQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (key: 'allowedWorkerTypeIds' | 'allowedEmployeeIds', id: string) =>
    setForm(f => ({ ...f, [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id] }));

  const people = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    return employees
      .filter(e => !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q))
      .sort((a, b) => Number(form.allowedEmployeeIds.includes(b.id)) - Number(form.allowedEmployeeIds.includes(a.id)));
  }, [employees, peopleQuery, form.allowedEmployeeIds]);

  async function save() {
    if (!profile?.orgId || !form.name.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, name: form.name.trim(), description: form.description.trim() || undefined };
      if (task) await updateTaskType(task.id, data);
      else await createTaskType(profile.orgId, data);
      onSaved();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not save task', message: e?.message?.includes('duplicate') ? 'A task with that name already exists.' : e?.message });
    } finally {
      setSaving(false);
    }
  }

  const nobodyLimit = !form.allowedWorkerTypeIds.length && !form.allowedEmployeeIds.length;

  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose} size="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!form.name.trim()}>Save task</Button>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-3 items-end">
          <Field label="Name">
            <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. #LN1 Desk" className={inputCls} />
          </Field>
          <div className="flex gap-1 pb-1.5">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} aria-label={`Use color ${c}`} aria-pressed={form.color === c}
                className={cn('h-6 w-6 rounded-full', form.color === c && 'ring-2 ring-offset-1 ring-gray-400')} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <Field label="Description (optional)">
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What the person does" className={inputCls} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-gray-700">
          <input type="checkbox" checked={form.isBreak} onChange={e => setForm(f => ({ ...f, isBreak: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span>
            <span className="font-medium">This is a break</span>
            <span className="block text-xs text-gray-500">Breaks don&apos;t count toward hour limits and go to someone working right before or after them.</span>
          </span>
        </label>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Who can do it</p>
          <div className="flex flex-wrap gap-1.5">
            {workerTypes.map(w => {
              const on = form.allowedWorkerTypeIds.includes(w.id);
              return (
                <button key={w.id} type="button" onClick={() => toggle('allowedWorkerTypeIds', w.id)} aria-pressed={on}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    on ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                  style={on ? { backgroundColor: w.color } : undefined}>
                  {w.name}
                </button>
              );
            })}
            {workerTypes.length === 0 && <span className="text-xs text-gray-500">Add worker types under Settings → Worker Types.</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {nobodyLimit ? 'Anyone can do this task.' : 'Only the selected worker types, plus anyone named below.'}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">
            Specific people {form.allowedEmployeeIds.length > 0 && <span className="font-normal text-gray-500">({form.allowedEmployeeIds.length} selected)</span>}
          </p>
          <input value={peopleQuery} onChange={e => setPeopleQuery(e.target.value)} placeholder="Search employees"
            aria-label="Search employees" className={cn(inputCls, 'mb-2')} />
          <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
            {people.length === 0 && <p className="p-3 text-xs text-gray-500">No employees found.</p>}
            {people.map(e => (
              <label key={e.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={form.allowedEmployeeIds.includes(e.id)} onChange={() => toggle('allowedEmployeeIds', e.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                <span className="flex-1">{e.firstName} {e.lastName}</span>
                <span className="text-xs text-gray-400">{workerTypes.find(w => w.id === e.workerTypeId)?.name ?? ''}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">Named people can always do this task, whatever their worker type.</p>
        </div>
      </div>
    </Modal>
  );
}
