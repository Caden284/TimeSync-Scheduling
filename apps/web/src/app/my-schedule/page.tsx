'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addWeeks, subWeeks, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Zap, LogOut, Clock, MapPin, Users, Plane, CalendarCog, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getShifts, getMyTimeOffRequests, createTimeOffRequest, getEmployee, setMyAvailability } from '@/lib/db';
import { todayISO, toISODate, parseISODate, weekRange, addDaysISO } from '@/lib/dates';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WeeklyAvailability } from '@/types';

const DAY_KEYS: (keyof WeeklyAvailability)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEAVE_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Bereavement', 'Jury Duty', 'FMLA', 'Other'];
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300', approved: 'bg-green-500/15 text-green-300', denied: 'bg-red-500/15 text-red-300',
};

export default function MySchedulePage() {
  const { user, profile, logout, loading } = useAuth();
  const router = useRouter();
  const [weekBase, setWeekBase] = useState(todayISO());
  const [shifts, setShifts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);

  const week = weekRange(weekBase);
  const weekLabel = `${format(parseISODate(week.start), 'MMM d')} – ${format(parseISODate(week.end), 'MMM d, yyyy')}`;
  const employeeId = profile?.employeeId;

  // Notification links open a specific week: /my-schedule?week=yyyy-MM-dd
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get('week');
    if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) setWeekBase(w);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user]);

  useEffect(() => {
    if (!profile?.orgId || !employeeId) { setFetching(false); return; }
    setFetching(true);
    // Staff only receive shifts from published weeks (enforced by the database).
    getShifts(profile.orgId, week.start, week.end)
      .then(rows => setShifts(rows.filter((s: any) => s.assignedEmployeeIds?.includes(employeeId))))
      .catch(() => setShifts([]))
      .finally(() => setFetching(false));
  }, [profile?.orgId, employeeId, week.start]);

  function loadRequests() {
    if (employeeId) getMyTimeOffRequests(employeeId).then(setRequests).catch(() => {});
  }
  useEffect(loadRequests, [employeeId]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(week.start, i));
  const totalHours = shifts.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 1440;
    return sum + mins / 60;
  }, 0);
  const today = todayISO();
  const upcomingRequests = requests.filter(r => r.endDate >= today);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">TimeSync</p>
            <p className="text-xs text-gray-500 truncate">{`${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || 'My Schedule'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {profile?.role === 'admin' && (
            <button onClick={() => router.push('/schedule')}
              className="hidden sm:block rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800">
              Admin view
            </button>
          )}
          <NotificationBell tone="dark" />
          <button onClick={handleLogout} aria-label="Sign out"
            className="flex items-center gap-2 rounded-lg px-2 sm:px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors">
            <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {!loading && profile && !employeeId ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <AlertCircle size={28} className="mx-auto text-amber-400 mb-3" />
            <p className="text-sm font-semibold">Your login isn&apos;t linked to an employee record yet</p>
            <p className="text-xs text-gray-400 mt-1.5">
              Ask an administrator to link you under Settings → Users &amp; Access. Your shifts will appear here once they do.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
            <button onClick={() => setWeekBase(toISODate(subWeeks(parseISODate(weekBase), 1)))} aria-label="Previous week"
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{weekLabel}</p>
              <p className="text-xs text-gray-500">
                {shifts.length} shift{shifts.length !== 1 ? 's' : ''} · {Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}h
              </p>
            </div>
            <button onClick={() => setWeekBase(toISODate(addWeeks(parseISODate(weekBase), 1)))} aria-label="Next week"
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-6">
            {fetching ? (
              <div className="flex items-center justify-center h-48">
                <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 sm:gap-3">
                {days.map((date, i) => {
                  const dayShifts = shifts.filter(s => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = date === today;
                  return (
                    <div key={date} className={cn('sm:min-h-32 rounded-lg sm:rounded-none', 'flex sm:block gap-3 sm:gap-0 p-2 sm:p-0', dayShifts.length === 0 && 'hidden sm:block')}>
                      <div className="w-12 sm:w-auto shrink-0 text-center sm:mb-2 sm:pb-2 sm:border-b border-gray-800">
                        <p className="text-xs text-gray-500">{DAY_NAMES[i].slice(0, 3)}</p>
                        <p className={cn('text-lg font-bold mt-0.5', isToday ? 'text-indigo-400' : 'text-white')}>{format(parseISODate(date), 'd')}</p>
                      </div>
                      <div className="flex-1 space-y-2">
                        {dayShifts.length === 0 ? (
                          <p className="text-xs text-gray-700 text-center pt-2">–</p>
                        ) : dayShifts.map(s => {
                          const coworkers = (s.assignedEmployeeNames ?? []).filter((_: string, idx: number) => s.assignedEmployeeIds[idx] !== employeeId);
                          return (
                            <div key={s.id} className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: (s.color ?? '#6366f1') + '25', borderLeft: `3px solid ${s.color ?? '#6366f1'}` }}>
                              <p className="font-semibold text-white truncate">{s.title ?? 'Shift'}</p>
                              <div className="flex items-center gap-1 mt-1 text-gray-300">
                                <Clock size={10} /><span>{s.startTime?.slice(0, 5)} – {s.endTime?.slice(0, 5)}</span>
                              </div>
                              {s.locationName && (
                                <div className="flex items-center gap-1 mt-0.5 text-gray-400"><MapPin size={10} /><span className="truncate">{s.locationName}</span></div>
                              )}
                              {coworkers.length > 0 && (
                                <div className="flex items-start gap-1 mt-0.5 text-gray-400"><Users size={10} className="mt-0.5 shrink-0" /><span>With {coworkers.join(', ')}</span></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!fetching && shifts.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">No shifts for you this week.</p>
                <p className="text-gray-600 text-xs mt-1">Shifts appear here once your manager publishes the week.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
              <div className="rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Plane size={14} className="text-indigo-400" /> Time off</p>
                  <button onClick={() => setShowTimeOff(true)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">Request</button>
                </div>
                {upcomingRequests.length === 0 ? (
                  <p className="text-xs text-gray-500">No upcoming requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingRequests.slice(0, 5).map(r => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-300">{r.leaveType} · {format(parseISODate(r.startDate), 'MMM d')}{r.endDate !== r.startDate ? `–${format(parseISODate(r.endDate), 'MMM d')}` : ''}</span>
                        <span className={cn('rounded-full px-2 py-0.5 capitalize', STATUS_STYLE[r.status])}>{r.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold flex items-center gap-2"><CalendarCog size={14} className="text-indigo-400" /> Availability</p>
                  <button onClick={() => setShowAvailability(true)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">Edit</button>
                </div>
                <p className="text-xs text-gray-500">Tell your manager which days and hours you can work. Scheduling uses it automatically.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {showTimeOff && profile && employeeId && (
        <TimeOffModal
          onClose={() => setShowTimeOff(false)}
          onSubmit={async data => {
            await createTimeOffRequest({
              orgId: profile.orgId, employeeId,
              employeeName: `${profile.firstName} ${profile.lastName}`.trim() || profile.email,
              ...data,
            });
            setShowTimeOff(false);
            loadRequests();
          }}
        />
      )}
      {showAvailability && employeeId && (
        <AvailabilityModal employeeId={employeeId} onClose={() => setShowAvailability(false)} />
      )}
    </div>
  );
}

function TimeOffModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (d: { leaveType: string; startDate: string; endDate: string; reason?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ leaveType: 'Vacation', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.startDate || !form.endDate) { setError('Choose a start and end date.'); return; }
    if (form.endDate < form.startDate) { setError('The end date is before the start date.'); return; }
    setSaving(true); setError('');
    try {
      await onSubmit({ ...form, reason: form.reason || undefined });
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the request.');
      setSaving(false);
    }
  }

  return (
    <Modal title="Request time off" subtitle="Your manager will be notified" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={submit} loading={saving}>Send request</Button>
      </>}>
      <div className="space-y-4 text-gray-900">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className={labelCls}>Type</label>
          <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} className={inputCls}>
            {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>From</label>
            <input type="date" value={form.startDate} min={todayISO()}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" value={form.endDate} min={form.startDate || todayISO()}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Note (optional)</label>
          <textarea value={form.reason} rows={2} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inputCls + ' resize-none'} />
        </div>
      </div>
    </Modal>
  );
}

function AvailabilityModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const [avail, setAvail] = useState<WeeklyAvailability | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployee(employeeId).then(emp => {
      const saved = emp?.weeklyAvailability ?? {};
      const blank = { start: '', end: '' };
      const base = Object.keys(saved).length
        ? saved
        : { mon: { start: '09:00', end: '17:00' }, tue: { start: '09:00', end: '17:00' }, wed: { start: '09:00', end: '17:00' }, thu: { start: '09:00', end: '17:00' }, fri: { start: '09:00', end: '17:00' } };
      setAvail(Object.fromEntries(DAY_KEYS.map(k => [k, base[k] ?? blank])) as WeeklyAvailability);
    }).catch(e => setError(e?.message ?? 'Could not load your availability.'));
  }, [employeeId]);

  async function save() {
    if (!avail) return;
    setSaving(true); setError('');
    try {
      await setMyAvailability(avail);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <Modal title="My availability" subtitle="When you're able to work each week" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!avail}>Save</Button>
      </>}>
      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {!avail ? (
        <div className="flex justify-center py-6"><div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" /></div>
      ) : (
        <div className="space-y-1.5">
          {DAY_KEYS.map((k, i) => {
            const on = avail[k].start !== '';
            return (
              <div key={k} className={cn('flex items-center gap-3 rounded-lg px-3 py-2', on ? 'bg-indigo-50/60' : 'bg-gray-50')}>
                <label className="flex items-center gap-2 w-28 text-sm text-gray-800">
                  <input type="checkbox" checked={on}
                    onChange={() => setAvail(a => ({ ...a!, [k]: on ? { start: '', end: '' } : { start: '09:00', end: '17:00' } }))} />
                  {DAY_NAMES[i]}
                </label>
                {on ? (
                  <div className="flex items-center gap-2">
                    <input type="time" value={avail[k].start} aria-label={`${DAY_NAMES[i]} start`}
                      onChange={e => setAvail(a => ({ ...a!, [k]: { ...a![k], start: e.target.value } }))}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700" />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="time" value={avail[k].end} aria-label={`${DAY_NAMES[i]} end`}
                      onChange={e => setAvail(a => ({ ...a!, [k]: { ...a![k], end: e.target.value } }))}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700" />
                  </div>
                ) : <span className="text-xs text-gray-400">Not available</span>}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
