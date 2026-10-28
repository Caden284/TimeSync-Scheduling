// Server-side loading of rule-engine data, shared by the AI Copilot and the
// open-shift routes. Pass the caller's client (RLS applies) or, after checking
// the caller yourself, the admin client.

import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysISO } from './dates';
import type { EngineContext, EngineEmployee, EngineRule, EngineShift, EngineTaskType, EngineWorkerType } from './rule-engine';

export interface OrgDb { client: SupabaseClient; orgId: string }

export const toShift = (r: any): EngineShift => ({
  id: r.id, date: r.date, startTime: r.start_time, endTime: r.end_time, title: r.title,
  departmentId: r.department_id, locationId: r.location_id, minStaff: r.min_staff, maxStaff: r.max_staff,
  assignedEmployeeIds: r.assigned_employee_ids ?? [], assignedEmployeeNames: r.assigned_employee_names ?? [],
  taskTypeId: r.task_type_id ?? null, preferredEmployeeIds: r.preferred_employee_ids ?? [],
});

export const toEmployee = (r: any): EngineEmployee & { departmentName?: string; employmentType?: string } => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, role: r.role, isActive: r.is_active,
  workerTypeId: r.worker_type_id ?? null,
  weeklyAvailability: r.weekly_availability, departmentName: r.department_name, employmentType: r.employment_type,
});

export const toTask = (r: any): EngineTaskType => ({
  id: r.id, name: r.name, isBreak: r.is_break,
  allowedWorkerTypeIds: r.allowed_worker_type_ids ?? [], allowedEmployeeIds: r.allowed_employee_ids ?? [],
});

export const toRule = (r: any): EngineRule & { description: string; priority: number } => ({
  name: r.name, ruleType: r.rule_type, constraintType: r.constraint_type, isEnabled: r.is_enabled,
  parameters: r.parameters, scopeDepts: r.scope_depts, scopeLocations: r.scope_locations, scopeRoles: r.scope_roles,
  scopeWorkerTypes: r.scope_worker_types ?? [], description: r.description, priority: r.priority,
});

export async function q<T = any>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// Shifts in a date range, page by page (pre-set weeks can exceed one page).
export async function shiftsBetween(db: OrgDb, from: string, to: string): Promise<any[]> {
  const all: any[] = [];
  for (let i = 0; ; i += 1000) {
    const rows = await q(db.client.from('shifts').select().eq('org_id', db.orgId)
      .gte('date', from).lte('date', to).order('date').order('start_time').order('id').range(i, i + 999));
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

// Worker and task types arrive with the tasks migration; before it, none.
export async function optional(p: PromiseLike<{ data: any[] | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  return error ? [] : data ?? [];
}

export async function loadTypes(db: OrgDb) {
  const [tasks, workers] = await Promise.all([
    optional(db.client.from('task_types').select().eq('org_id', db.orgId)),
    optional(db.client.from('worker_types').select('id, name').eq('org_id', db.orgId).order('sort_order')),
  ]);
  return { taskTypes: tasks.map(toTask), workerTypes: workers as EngineWorkerType[] };
}

// Rules engine context for shifts between `from` and `to` (plus a week each side).
export async function loadEngine(db: OrgDb, from: string, to: string) {
  const c = db.client;
  const wFrom = addDaysISO(from, -7), wTo = addDaysISO(to, 7);
  const [shifts, employees, rules, timeOff, overrides, types] = await Promise.all([
    shiftsBetween(db, wFrom, wTo),
    q(c.from('employees').select().eq('org_id', db.orgId).eq('is_active', true).limit(500)),
    q(c.from('scheduling_rules').select().eq('org_id', db.orgId)),
    q(c.from('time_off_requests').select().eq('org_id', db.orgId).neq('status', 'denied').lte('start_date', wTo).gte('end_date', wFrom)),
    q(c.from('availability_overrides').select().eq('org_id', db.orgId).gte('date', wFrom).lte('date', wTo)),
    loadTypes(db),
  ]);
  const ctx: EngineContext = {
    ...types,
    shifts: shifts.map(toShift),
    rules: rules.map(toRule),
    timeOff: timeOff.map((t: any) => ({ employeeId: t.employee_id, startDate: t.start_date, endDate: t.end_date, status: t.status, leaveType: t.leave_type })),
    overrides: overrides.map((o: any) => ({ employeeId: o.employee_id, date: o.date, isAvailable: o.is_available, altStartTime: o.alt_start_time, altEndTime: o.alt_end_time, reason: o.reason })),
  };
  return { ctx, employees: employees.map(toEmployee) };
}

export async function getShift(db: OrgDb, shiftId: string): Promise<EngineShift> {
  const row = await q(db.client.from('shifts').select().eq('id', shiftId).eq('org_id', db.orgId).maybeSingle());
  if (!row) throw new Error(`Shift ${shiftId} not found.`);
  return toShift(row);
}

export async function writeAssignments(db: OrgDb, shift: EngineShift, ids: string[], names: string[]) {
  const isOpen = ids.length < Math.max(1, shift.minStaff ?? 1);
  await q(db.client.from('shifts').update({
    assigned_employee_ids: ids, assigned_employee_names: names,
    is_open: isOpen, status: isOpen ? 'open' : 'scheduled',
  }).eq('id', shift.id).eq('org_id', db.orgId).select('id').single());
}

export const label = (s: EngineShift) => `${s.title || 'Shift'} on ${s.date} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`;

