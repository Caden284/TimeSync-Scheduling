// Open-shift pickup: staff see unfilled shifts in published weeks that they
// could work without breaking a hard rule, and claim them. Staff can't write
// shifts themselves (RLS), so these run with the admin client after the
// caller and every rule have been checked here.

import { createAdminClient, HttpError, type Caller } from './supabase-server';
import { addDaysISO, todayISO } from './dates';
import { checkAssignment, staffTarget, worstSeverity, type EngineShift } from './rule-engine';
import { label, loadEngine, q, type OrgDb } from './engine-server';

export async function staffContext(caller: Caller) {
  const { data: profile } = await caller.client.from('user_profiles')
    .select('employee_id').eq('user_id', caller.user.id).maybeSingle();
  if (!profile?.employee_id) throw new HttpError(403, 'Your login is not linked to an employee record.');
  const admin: OrgDb = { client: createAdminClient(), orgId: caller.orgId };
  return { admin, employeeId: profile.employee_id as string };
}

async function publishedWeeks(db: OrgDb, from: string, to: string) {
  const rows = await q(db.client.from('schedules').select('week_start, week_end')
    .eq('org_id', db.orgId).eq('status', 'published').lte('week_start', to).gte('week_end', from));
  return (date: string) => rows.some((w: any) => date >= w.week_start && date <= w.week_end);
}

export async function listClaimable(db: OrgDb, employeeId: string, from = todayISO(), to = addDaysISO(todayISO(), 21)) {
  const [{ ctx, employees }, isPublished] = await Promise.all([loadEngine(db, from, to), publishedWeeks(db, from, to)]);
  const me = employees.find(e => e.id === employeeId);
  if (!me) throw new HttpError(403, 'Your employee record is inactive.');
  const tasks = new Map((ctx.taskTypes ?? []).map(t => [t.id, t]));
  return ctx.shifts
    .filter(s => s.date >= from && s.date <= to && isPublished(s.date))
    .filter(s => !tasks.get(s.taskTypeId ?? '')?.isBreak)
    .filter(s => s.assignedEmployeeIds.length < staffTarget(s, ctx.rules))
    .map(s => ({ shift: s, conflicts: checkAssignment(s, me, ctx) }))
    .filter(({ conflicts }) => worstSeverity(conflicts) !== 'block')
    .sort((a, b) => (a.shift.date + a.shift.startTime).localeCompare(b.shift.date + b.shift.startTime))
    .map(({ shift, conflicts }) => ({
      id: shift.id, date: shift.date, startTime: shift.startTime.slice(0, 5), endTime: shift.endTime.slice(0, 5),
      title: shift.title ?? 'Shift', task: tasks.get(shift.taskTypeId ?? '')?.name ?? null,
      needs: staffTarget(shift, ctx.rules) - shift.assignedEmployeeIds.length,
      warnings: conflicts.map(c => c.message),
    }));
}

export async function claim(db: OrgDb, employeeId: string, shiftId: string) {
  const row = await q<any>(db.client.from('shifts').select().eq('id', shiftId).eq('org_id', db.orgId).maybeSingle());
  if (!row) throw new HttpError(404, 'That shift no longer exists.');
  const date: string = row.date;
  if (date < todayISO()) throw new HttpError(400, 'That shift has already started.');
  if (!(await publishedWeeks(db, date, date))(date)) throw new HttpError(403, 'That week is not published.');

  const { ctx, employees } = await loadEngine(db, date, date);
  const shift = ctx.shifts.find(s => s.id === shiftId) as EngineShift;
  const me = employees.find(e => e.id === employeeId);
  if (!me) throw new HttpError(403, 'Your employee record is inactive.');
  if (shift.assignedEmployeeIds.length >= staffTarget(shift, ctx.rules)) throw new HttpError(409, 'Someone already picked up that shift.');
  const blocks = checkAssignment(shift, me, ctx).filter(c => c.severity === 'block');
  if (blocks.length) throw new HttpError(409, blocks.map(c => c.message).join(' '));

  const name = `${me.firstName} ${me.lastName}`.trim();
  const ids = [...shift.assignedEmployeeIds, me.id];
  const isOpen = ids.length < Math.max(1, shift.minStaff ?? 1);
  // Only succeeds if nobody else changed the shift since it was read.
  const { data: updated, error } = await db.client.from('shifts').update({
    assigned_employee_ids: ids, assigned_employee_names: [...(shift.assignedEmployeeNames ?? []), name],
    is_open: isOpen, status: isOpen ? 'open' : 'scheduled',
  }).eq('id', shift.id).eq('org_id', db.orgId).eq('updated_at', row.updated_at).select('id');
  if (error) throw new Error(error.message);
  if (!updated?.length) throw new HttpError(409, 'That shift just changed. Refresh and try again.');

  const admins = await q(db.client.from('user_profiles').select('user_id').eq('org_id', db.orgId).eq('role', 'admin'));
  if (admins.length) {
    await db.client.from('notifications').insert(admins.map((a: any) => ({
      org_id: db.orgId, user_id: a.user_id, type: 'open_shift_claimed',
      title: 'Open shift picked up', body: `${name} · ${label(shift)}`, link: '/schedule',
    })));
  }
  return { message: `You're on ${label(shift)}.` };
}
