'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { HandHelping, CalendarPlus, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAppStore } from '@/store';
import { authHeaders } from '@/lib/supabase';
import { getEmployee, rotateMyCalendarToken } from '@/lib/db';
import { parseISODate } from '@/lib/dates';

interface OpenShift {
  id: string; date: string; startTime: string; endTime: string; title: string;
  task: string | null; needs: number; warnings: string[];
}

// Unfilled shifts in published weeks that this person can work.
export function OpenShiftsCard({ onClaimed }: { onClaimed: () => void }) {
  const { addToast } = useAppStore();
  const [shifts, setShifts] = useState<OpenShift[] | null>(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState<string | null>(null);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/shifts/open', { headers: await authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load open shifts.');
      setShifts(body.shifts);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load open shifts.');
      setShifts([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function claim(s: OpenShift) {
    if (s.warnings.length && !(await confirmDialog({
      title: 'Pick up this shift?',
      message: `Heads up: ${s.warnings.join(' ')}`,
      confirmLabel: 'Pick it up',
    }))) return;
    setClaiming(s.id);
    try {
      const res = await fetch('/api/shifts/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ shiftId: s.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not pick up the shift.');
      addToast({ type: 'success', title: 'Shift picked up', message: body.message });
      onClaimed();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not pick up the shift', message: e?.message });
    } finally {
      setClaiming(null);
      load();
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 p-4">
      <p className="text-sm font-semibold flex items-center gap-2 mb-3"><HandHelping size={14} className="text-indigo-400" /> Open shifts you can pick up</p>
      {shifts === null ? (
        <Loader2 size={16} className="animate-spin text-gray-500" />
      ) : error ? (
        <p className="text-xs text-gray-500">{error}</p>
      ) : shifts.length === 0 ? (
        <p className="text-xs text-gray-500">Nothing open right now in the next three weeks.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {shifts.map(s => (
            <li key={s.id} className="flex items-center gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 truncate">{s.title}{s.task && s.task !== s.title ? ` · ${s.task}` : ''}</p>
                <p className="text-gray-500">{format(parseISODate(s.date), 'EEE MMM d')} · {s.startTime}–{s.endTime}{s.warnings.length ? ' · ⚠' : ''}</p>
              </div>
              <button onClick={() => claim(s)} disabled={claiming !== null}
                className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {claiming === s.id ? 'Picking up…' : 'Pick up'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A private iCal link Google/Apple/Outlook Calendar can subscribe to.
export function CalendarFeedCard({ employeeId }: { employeeId: string }) {
  const { addToast } = useAppStore();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    getEmployee(employeeId).then(e => setToken(e?.calendarToken ?? null)).catch(() => {});
  }, [employeeId]);

  const url = token ? `${window.location.origin}/api/calendar/${token}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: 'info', title: 'Copy the link', message: url });
    }
  }

  async function rotate() {
    if (!(await confirmDialog({
      title: 'Make a new calendar link?',
      message: 'The old link stops working. Calendars subscribed to it need the new one.',
      confirmLabel: 'New link',
    }))) return;
    setRotating(true);
    try { setToken(await rotateMyCalendarToken()); }
    catch (e: any) { addToast({ type: 'error', title: 'Could not make a new link', message: e?.message }); }
    finally { setRotating(false); }
  }

  return (
    <div className="rounded-xl border border-gray-800 p-4">
      <p className="text-sm font-semibold flex items-center gap-2 mb-1"><CalendarPlus size={14} className="text-indigo-400" /> Add to your calendar</p>
      <p className="text-xs text-gray-500 mb-3">
        Subscribe to this link in Google Calendar (Other calendars → From URL), Apple Calendar, or Outlook. Published shifts show up automatically. Keep it private.
      </p>
      {!token ? (
        <p className="text-xs text-gray-500">Calendar links are not available yet.</p>
      ) : (
        <div className="flex items-center gap-2">
          <input readOnly value={url} aria-label="Calendar link" onFocus={e => e.target.select()}
            className="flex-1 min-w-0 rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-300" />
          <button onClick={copy} aria-label="Copy calendar link" className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <button onClick={rotate} disabled={rotating} aria-label="Make a new calendar link" className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800">
            <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} />
          </button>
        </div>
      )}
    </div>
  );
}

export function GiveAwayModal({ shift, onClose, onSubmit }: {
  shift: any; onClose: () => void; onSubmit: (note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true); setError('');
    try { await onSubmit(note.trim() || undefined); }
    catch (e: any) { setError(e?.message?.includes('duplicate') ? 'You already asked to give this shift away.' : e?.message ?? 'Could not send the request.'); setSaving(false); }
  }

  return (
    <Modal title="Give away this shift?" subtitle={`${shift.title ?? 'Shift'} · ${format(parseISODate(shift.date), 'EEE MMM d')} ${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={submit} loading={saving}>Send request</Button>
      </>}>
      <div className="space-y-3 text-gray-900">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <p className="text-sm text-gray-600">Your manager decides. You stay on the shift until they approve.</p>
        <div>
          <label className={labelCls} htmlFor="drop-note">Reason (optional)</label>
          <textarea id="drop-note" value={note} rows={2} onChange={e => setNote(e.target.value)} className={inputCls + ' resize-none'} />
        </div>
      </div>
    </Modal>
  );
}
