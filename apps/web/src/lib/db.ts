'use client';

import { supabase, TABLES, fromRow, toRow, must } from './supabase';
import { todayISO } from './dates';

// Access control is enforced by Row Level Security in Postgres
// (supabase/migrations): users only ever see their own organization's rows,
// and only admins can write. Nothing here needs to attach permissions.

async function insertOne(table: string, data: Record<string, any>) {
  return fromRow(must(await supabase.from(table).insert(toRow(data)).select().single()));
}

async function updateOne(table: string, id: string, data: Record<string, any>) {
  return fromRow(must(await supabase.from(table).update(toRow(data)).eq('id', id).select().single()));
}

async function deleteOne(table: string, id: string) {
  must(await supabase.from(table).delete().eq('id', id));
}

// Empty strings from unset form fields are not valid uuids.
function nullIfEmpty(v?: string | null) {
  return v ? v : null;
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getOrg(orgId: string) {
  return fromRow(must(await supabase.from(TABLES.ORGANIZATIONS).select().eq('id', orgId).single()));
}

export async function createOrg(data: {
  name: string; vertical: string; timezone: string;
  primaryColor: string; logoInitials: string;
}) {
  return insertOne(TABLES.ORGANIZATIONS, data);
}

export async function updateOrg(orgId: string, data: Partial<{
  name: string; vertical: string; timezone: string;
  primaryColor: string; logoInitials: string;
}>) {
  return updateOne(TABLES.ORGANIZATIONS, orgId, data);
}

// ── Departments ───────────────────────────────────────────────────────────────

export async function getDepartments(orgId: string) {
  const rows = must(await supabase.from(TABLES.DEPARTMENTS).select()
    .eq('org_id', orgId).order('name').limit(100));
  return rows.map(r => fromRow(r));
}

export async function createDepartment(orgId: string, name: string, color: string) {
  return insertOne(TABLES.DEPARTMENTS, { orgId, name, color });
}

export async function deleteDepartment(deptId: string) {
  return deleteOne(TABLES.DEPARTMENTS, deptId);
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function getLocations(orgId: string) {
  const rows = must(await supabase.from(TABLES.LOCATIONS).select()
    .eq('org_id', orgId).order('name').limit(100));
  return rows.map(r => fromRow(r));
}

export async function createLocation(orgId: string, data: { name: string; city?: string; state?: string }) {
  return insertOne(TABLES.LOCATIONS, { orgId, ...data });
}

export async function deleteLocation(locationId: string) {
  return deleteOne(TABLES.LOCATIONS, locationId);
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function getEmployees(orgId: string) {
  const rows = must(await supabase.from(TABLES.EMPLOYEES).select()
    .eq('org_id', orgId).eq('is_active', true).order('last_name').limit(500));
  return rows.map(r => fromRow(r));
}

export async function getEmployee(employeeId: string) {
  const row = must(await supabase.from(TABLES.EMPLOYEES).select().eq('id', employeeId).maybeSingle());
  return row ? fromRow(row) : null;
}

export async function createEmployee(orgId: string, data: {
  firstName: string; lastName: string; email: string; phone?: string;
  role: string; departmentId?: string; departmentName?: string; employmentType: string; payRate?: number;
}) {
  return insertOne(TABLES.EMPLOYEES, { orgId, ...data, isActive: true });
}

export async function updateEmployee(employeeId: string, data: Record<string, unknown>) {
  return updateOne(TABLES.EMPLOYEES, employeeId, data);
}

// Removes an employee from scheduling without destroying their history:
// marks them inactive and takes them off any upcoming shifts.
export async function deactivateEmployee(employeeId: string) {
  await updateOne(TABLES.EMPLOYEES, employeeId, { isActive: false });
  const upcoming = must(await supabase.from(TABLES.SHIFTS)
    .select('id, assigned_employee_ids, assigned_employee_names, min_staff')
    .contains('assigned_employee_ids', [employeeId])
    .gte('date', todayISO()));
  for (const s of upcoming) {
    const idx = s.assigned_employee_ids.indexOf(employeeId);
    const ids = s.assigned_employee_ids.filter((_: string, i: number) => i !== idx);
    const names = (s.assigned_employee_names ?? []).filter((_: string, i: number) => i !== idx);
    await setShiftAssignments(s.id, ids, names, s.min_staff);
  }
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export async function getSchedules(orgId: string) {
  const rows = must(await supabase.from(TABLES.SCHEDULES).select()
    .eq('org_id', orgId).order('week_start', { ascending: false }).limit(52));
  return rows.map(r => fromRow(r));
}

export async function getWeekSchedule(orgId: string, weekStart: string) {
  const row = must(await supabase.from(TABLES.SCHEDULES).select()
    .eq('org_id', orgId).eq('week_start', weekStart).maybeSingle());
  return row ? fromRow(row) : null;
}

// Publishing a week makes its shifts visible to staff and notifies them
// (database trigger). Unpublishing hides the week again.
export async function setWeekStatus(orgId: string, weekStart: string, weekEnd: string, status: 'draft' | 'published') {
  return fromRow(must(await supabase.from(TABLES.SCHEDULES).upsert(toRow({
    orgId, weekStart, weekEnd, status,
    publishedAt: status === 'published' ? new Date().toISOString() : null,
  }), { onConflict: 'org_id,week_start' }).select().single()));
}

export async function createSchedule(orgId: string, weekStart: string, weekEnd: string) {
  return insertOne(TABLES.SCHEDULES, { orgId, weekStart, weekEnd, status: 'draft' });
}

export async function updateScheduleStatus(scheduleId: string, status: 'draft' | 'review' | 'published') {
  return updateOne(TABLES.SCHEDULES, scheduleId, { status });
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function getShifts(orgId: string, weekStart?: string, weekEnd?: string) {
  let q = supabase.from(TABLES.SHIFTS).select().eq('org_id', orgId);
  if (weekStart) q = q.gte('date', weekStart);
  if (weekEnd)   q = q.lte('date', weekEnd);
  const rows = must(await q.order('date').order('start_time').limit(500));
  return rows.map(r => fromRow(r));
}

export async function createShift(data: {
  orgId: string; scheduleId?: string; title?: string;
  date: string; startTime: string; endTime: string;
  departmentId?: string; departmentName?: string; departmentColor?: string;
  locationId?: string; locationName?: string;
  shiftType: string; status: string; isOpen: boolean;
  minStaff: number; maxStaff?: number; color?: string; notes?: string;
}) {
  return insertOne(TABLES.SHIFTS, { ...data, scheduleId: nullIfEmpty(data.scheduleId) ?? undefined });
}

// Inserts many shifts at once. Rows with a templateId that already exist for
// that date are skipped, so generating from templates twice is harmless.
export async function createShifts(rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const inserted = must(await supabase.from(TABLES.SHIFTS)
    .upsert(rows.map(toRow), { onConflict: 'template_id,date', ignoreDuplicates: true })
    .select('id'));
  return inserted.length;
}

// A shift is "open" until it has its minimum staff.
export async function setShiftAssignments(shiftId: string, employeeIds: string[], employeeNames: string[], minStaff = 1) {
  const isOpen = employeeIds.length < Math.max(1, minStaff);
  return updateOne(TABLES.SHIFTS, shiftId, {
    assignedEmployeeIds: employeeIds,
    assignedEmployeeNames: employeeNames,
    isOpen,
    status: isOpen ? 'open' : 'scheduled',
  });
}

export async function updateShift(shiftId: string, data: Record<string, unknown>) {
  return updateOne(TABLES.SHIFTS, shiftId, data);
}

export async function deleteShift(shiftId: string) {
  return deleteOne(TABLES.SHIFTS, shiftId);
}

// ── Shift Assignments ─────────────────────────────────────────────────────────

export async function getAssignments(shiftId: string) {
  const rows = must(await supabase.from(TABLES.SHIFT_ASSIGNMENTS).select().eq('shift_id', shiftId));
  return rows.map(r => fromRow(r));
}

export async function assignEmployee(shiftId: string, employeeId: string, employeeName: string) {
  return insertOne(TABLES.SHIFT_ASSIGNMENTS, { shiftId, employeeId, employeeName, status: 'confirmed' });
}

export async function removeAssignment(assignmentId: string) {
  return deleteOne(TABLES.SHIFT_ASSIGNMENTS, assignmentId);
}

// ── Time Off Requests ─────────────────────────────────────────────────────────

export async function getTimeOffRequests(orgId: string) {
  const rows = must(await supabase.from(TABLES.TIME_OFF_REQUESTS).select()
    .eq('org_id', orgId).order('created_at', { ascending: false }).limit(200));
  return rows.map(r => fromRow(r));
}

// Pending and approved requests that overlap [from, to].
export async function getTimeOffInRange(orgId: string, from: string, to: string) {
  const rows = must(await supabase.from(TABLES.TIME_OFF_REQUESTS).select()
    .eq('org_id', orgId).neq('status', 'denied').lte('start_date', to).gte('end_date', from));
  return rows.map(r => fromRow(r));
}

export async function getMyTimeOffRequests(employeeId: string) {
  const rows = must(await supabase.from(TABLES.TIME_OFF_REQUESTS).select()
    .eq('employee_id', employeeId).order('start_date', { ascending: false }).limit(50));
  return rows.map(r => fromRow(r));
}

export async function createTimeOffRequest(data: {
  orgId: string; employeeId: string; employeeName: string;
  leaveType: string; startDate: string; endDate: string; reason?: string;
}) {
  return insertOne(TABLES.TIME_OFF_REQUESTS, {
    ...data, employeeId: nullIfEmpty(data.employeeId), status: 'pending',
  });
}

export async function updateTimeOffStatus(requestId: string, status: 'approved' | 'denied') {
  return updateOne(TABLES.TIME_OFF_REQUESTS, requestId, { status });
}

// ── Scheduling Rules ──────────────────────────────────────────────────────────

export async function getRules(orgId: string) {
  const rows = must(await supabase.from(TABLES.SCHEDULING_RULES).select()
    .eq('org_id', orgId).order('priority').limit(200));
  return rows.map(rowToRule);
}

export async function createRule(orgId: string, data: {
  name: string; ruleType: string; constraintType: string;
  description?: string; isEnabled?: boolean; isSystem?: boolean;
  priority: number; weight?: number; parameters?: Record<string, unknown>;
  scopeDepts?: string[]; scopeLocations?: string[]; scopeRoles?: string[];
}) {
  const row = must(await supabase.from(TABLES.SCHEDULING_RULES).insert(toRow({
    orgId,
    name: data.name,
    ruleType: data.ruleType,
    constraintType: data.constraintType,
    description: data.description ?? '',
    isEnabled: data.isEnabled ?? true,
    isSystem: data.isSystem ?? false,
    priority: data.priority,
    weight: data.weight ?? null,
    parameters: data.parameters ?? {},
    scopeDepts: data.scopeDepts ?? [],
    scopeLocations: data.scopeLocations ?? [],
    scopeRoles: data.scopeRoles ?? [],
  })).select().single());
  return rowToRule(row);
}

export async function updateRule(ruleId: string, patch: {
  name?: string; description?: string; isEnabled?: boolean; constraintType?: 'hard' | 'soft';
  priority?: number; weight?: number; parameters?: Record<string, unknown>;
}) {
  return updateOne(TABLES.SCHEDULING_RULES, ruleId, patch);
}

export async function toggleRule(ruleId: string, isEnabled: boolean) {
  return updateOne(TABLES.SCHEDULING_RULES, ruleId, { isEnabled });
}

export async function deleteRule(ruleId: string) {
  return deleteOne(TABLES.SCHEDULING_RULES, ruleId);
}

function rowToRule(row: any) {
  const r = fromRow(row);
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    ruleType: r.ruleType,
    constraintType: r.constraintType as 'hard' | 'soft',
    description: r.description ?? '',
    isEnabled: r.isEnabled ?? true,
    isSystem: r.isSystem ?? false,
    priority: r.priority ?? 50,
    weight: r.weight ?? undefined,
    parameters: r.parameters ?? {},
    conditions: [],
    scopeDepts: r.scopeDepts ?? [],
    scopeLocations: r.scopeLocations ?? [],
    scopeRoles: r.scopeRoles ?? [],
    createdAt: r.createdAt,
  };
}

// ── Seasons ───────────────────────────────────────────────────────────────────

const EMPTY_HOURS = { sun: { start: '', end: '' }, mon: { start: '', end: '' }, tue: { start: '', end: '' }, wed: { start: '', end: '' }, thu: { start: '', end: '' }, fri: { start: '', end: '' }, sat: { start: '', end: '' } };

function parseHoursJson(hoursJson?: string) {
  if (hoursJson === undefined) return undefined;
  try { return JSON.parse(hoursJson); } catch { return EMPTY_HOURS; }
}

export async function getSeasons(orgId: string) {
  const rows = must(await supabase.from(TABLES.SEASONS).select()
    .eq('org_id', orgId).order('start_date').limit(50));
  return rows.map(rowToSeason);
}

export async function createSeason(orgId: string, data: {
  name: string; seasonType: string; startDate: string; endDate: string;
  isActive?: boolean; hoursJson: string;
}) {
  const { hoursJson, ...rest } = data;
  const row = must(await supabase.from(TABLES.SEASONS).insert(toRow({
    orgId, ...rest, isActive: data.isActive ?? false, hours: parseHoursJson(hoursJson),
  })).select().single());
  return rowToSeason(row);
}

export async function updateSeason(seasonId: string, data: Partial<{
  name: string; seasonType: string; startDate: string; endDate: string;
  isActive: boolean; hoursJson: string;
}>) {
  const { hoursJson, ...rest } = data;
  const row = must(await supabase.from(TABLES.SEASONS)
    .update(toRow({ ...rest, hours: parseHoursJson(hoursJson) }))
    .eq('id', seasonId).select().single());
  return rowToSeason(row);
}

export async function deleteSeason(seasonId: string) {
  return deleteOne(TABLES.SEASONS, seasonId);
}

function rowToSeason(row: any) {
  const r = fromRow(row);
  const hours = r.hours && Object.keys(r.hours).length > 0 ? r.hours : EMPTY_HOURS;
  return { id: r.id, orgId: r.orgId, name: r.name, seasonType: r.seasonType, startDate: r.startDate, endDate: r.endDate, isActive: r.isActive ?? false, hours, createdAt: r.createdAt };
}

// ── Shift Templates ───────────────────────────────────────────────────────────

export async function getShiftTemplates(orgId: string, seasonId?: string) {
  let q = supabase.from(TABLES.SHIFT_TEMPLATES).select().eq('org_id', orgId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const rows = must(await q.order('start_time').limit(200));
  return rows.map(rowToTemplate);
}

export async function createShiftTemplate(orgId: string, data: {
  seasonId: string; name: string; startTime: string; endTime: string;
  color?: string; departmentId?: string; departmentName?: string;
  minStaff?: number; daysOfWeek: number[]; isActive?: boolean; notes?: string;
}) {
  const row = must(await supabase.from(TABLES.SHIFT_TEMPLATES).insert(toRow({
    orgId, ...data, minStaff: data.minStaff ?? 1, isActive: data.isActive ?? true,
  })).select().single());
  return rowToTemplate(row);
}

export async function updateShiftTemplate(templateId: string, data: Partial<{
  name: string; startTime: string; endTime: string; color: string;
  departmentId: string; departmentName: string; minStaff: number;
  daysOfWeek: number[]; isActive: boolean; notes: string;
}>) {
  const row = must(await supabase.from(TABLES.SHIFT_TEMPLATES)
    .update(toRow(data)).eq('id', templateId).select().single());
  return rowToTemplate(row);
}

export async function deleteShiftTemplate(templateId: string) {
  return deleteOne(TABLES.SHIFT_TEMPLATES, templateId);
}

function rowToTemplate(row: any) {
  const r = fromRow(row);
  // Postgres `time` comes back as HH:mm:ss; the template editor works in HH:mm.
  return { id: r.id, orgId: r.orgId, seasonId: r.seasonId, name: r.name, startTime: r.startTime?.slice(0, 5), endTime: r.endTime?.slice(0, 5), color: r.color ?? '#6366f1', departmentId: r.departmentId, departmentName: r.departmentName, minStaff: r.minStaff ?? 1, daysOfWeek: r.daysOfWeek ?? [], isActive: r.isActive ?? true, notes: r.notes, createdAt: r.createdAt };
}

// ── Employee Availability ─────────────────────────────────────────────────────

export async function updateEmployeeAvailability(employeeId: string, weeklyAvailability: object) {
  return updateOne(TABLES.EMPLOYEES, employeeId, { weeklyAvailability });
}

export async function setMyAvailability(weeklyAvailability: object) {
  must(await supabase.rpc('set_my_availability', { p_availability: weeklyAvailability }));
}

// ── Availability overrides ────────────────────────────────────────────────────

export async function getAvailabilityOverrides(orgId: string, from: string, to: string) {
  const rows = must(await supabase.from(TABLES.AVAILABILITY_OVERRIDES).select()
    .eq('org_id', orgId).gte('date', from).lte('date', to));
  return rows.map(r => fromRow(r));
}

// ── Users & access ────────────────────────────────────────────────────────────

export async function getOrgUsers(orgId: string) {
  const rows = must(await supabase.from(TABLES.USER_PROFILES).select()
    .eq('org_id', orgId).order('last_name'));
  return rows.map(r => fromRow(r));
}

export async function updateUserProfile(profileId: string, data: { role?: 'admin' | 'staff'; employeeId?: string | null }) {
  return updateOne(TABLES.USER_PROFILES, profileId, data);
}

export async function completeOnboarding(orgId: string) {
  return updateOne(TABLES.ORGANIZATIONS, orgId, { onboardingCompletedAt: new Date().toISOString() });
}

// ── Notifications ─────────────────────────────────────────────────────────────
// Created by database triggers; users can only read, mark read, and dismiss.

export async function getNotifications(limit = 30) {
  const rows = must(await supabase.from(TABLES.NOTIFICATIONS).select()
    .order('created_at', { ascending: false }).limit(limit));
  return rows.map(r => fromRow(r));
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  must(await supabase.from(TABLES.NOTIFICATIONS)
    .update({ read_at: new Date().toISOString() }).in('id', ids));
}

export async function dismissNotification(id: string) {
  return deleteOne(TABLES.NOTIFICATIONS, id);
}
