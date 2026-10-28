'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { createWorkerType, deleteWorkerType, getEmployees, updateWorkerType } from '@/lib/db';
import { cn } from '@/lib/utils';
import { COLORS, Field, SectionHeader, SettingsCard, inputCls } from './parts';

// Kinds of worker (Staff, Student, Volunteer, …). Tasks can be limited to
// certain types, and rules can apply to one type only.
export function WorkerTypesSection() {
  const { addToast } = useAppStore();
  const { profile } = useAuth();
  const { workerTypes, refresh } = useOrgData();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[2]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!profile?.orgId) return;
    getEmployees(profile.orgId).then(emps => {
      const c: Record<string, number> = {};
      for (const e of emps) if (e.workerTypeId) c[e.workerTypeId] = (c[e.workerTypeId] ?? 0) + 1;
      setCounts(c);
    }).catch(() => {});
  }, [profile?.orgId]);

  async function run(key: string, fn: () => Promise<unknown>, failTitle: string) {
    setBusy(key);
    try { await fn(); await refresh(); return true; }
    catch (e: any) { addToast({ type: 'error', title: failTitle, message: e?.message }); return false; }
    finally { setBusy(null); }
  }

  async function add() {
    if (!profile?.orgId || !name.trim()) return;
    const ok = await run('add', () => createWorkerType(profile.orgId!, { name: name.trim(), color, sortOrder: workerTypes.length + 1 }), 'Could not add worker type');
    if (ok) setName('');
  }

  async function saveName() {
    if (!editing?.name.trim()) return;
    const ok = await run(editing.id, () => updateWorkerType(editing.id, { name: editing.name.trim() }), 'Could not rename');
    if (ok) setEditing(null);
  }

  async function remove(id: string, typeName: string) {
    const n = counts[id] ?? 0;
    if (!(await confirmDialog({
      title: `Delete ${typeName}?`,
      message: n ? `${n} employee${n === 1 ? '' : 's'} will have no worker type, and tasks limited to ${typeName} lose that limit.` : `Tasks limited to ${typeName} lose that limit.`,
      confirmLabel: 'Delete', danger: true,
    }))) return;
    await run(id, () => deleteWorkerType(id), 'Could not delete worker type');
  }

  return (
    <>
      <SectionHeader title="Worker Types"
        desc="Group people by kind of worker, such as Staff and Student. Tasks can be limited to certain types, and rules can apply to one type only." />
      <SettingsCard>
        <div className="flex gap-2 items-end">
          <Field label="New worker type">
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="e.g. Graduate Assistant" className={inputCls} />
          </Field>
          <div className="flex gap-1 pb-1.5">
            {COLORS.slice(0, 6).map(c => (
              <button key={c} onClick={() => setColor(c)} aria-label={`Use color ${c}`} aria-pressed={color === c}
                className={cn('h-6 w-6 rounded-full', color === c && 'ring-2 ring-offset-1 ring-gray-400')} style={{ backgroundColor: c }} />
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={add} loading={busy === 'add'} disabled={!name.trim()} leftIcon={<Plus size={13} />}>
            Add
          </Button>
        </div>
        {workerTypes.length === 0 ? (
          <p className="text-sm text-gray-500">No worker types yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 -mx-1">
            {workerTypes.map(w => (
              <li key={w.id} className="flex items-center gap-3 px-1 py-2.5">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                {editing?.id === w.id ? (
                  <>
                    <input autoFocus value={editing.name} aria-label="Worker type name"
                      onChange={e => setEditing({ id: w.id, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(null); }}
                      className={cn(inputCls, 'py-1')} />
                    <button onClick={saveName} aria-label="Save name" className="p-1 rounded-md text-green-600 hover:bg-green-50"><Check size={14} /></button>
                    <button onClick={() => setEditing(null)} aria-label="Cancel" className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{w.name}</span>
                    <span className="text-xs text-gray-400">{counts[w.id] ?? 0} {(counts[w.id] ?? 0) === 1 ? 'person' : 'people'}</span>
                    <button onClick={() => setEditing({ id: w.id, name: w.name })} aria-label={`Rename ${w.name}`}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={14} /></button>
                    <button onClick={() => remove(w.id, w.name)} disabled={busy !== null} aria-label={`Delete ${w.name}`}
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                      {busy === w.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500">Set each person&apos;s type on the Employees page.</p>
      </SettingsCard>
    </>
  );
}
