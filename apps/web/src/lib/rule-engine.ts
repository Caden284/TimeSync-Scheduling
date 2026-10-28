// ============================================================
// Rule engine: decides whether an employee can take a shift.
//
// Pure functions with no browser or database access, so the same checks run
// in the assignment picker, the auto-scheduler, and the AI Copilot's server
// tools. Hard rules block an assignment; soft rules warn.
// ============================================================

export interface EngineShift {
  id: string;
  date: string;               // yyyy-MM-dd
  startTime: string;          // HH:mm or HH:mm:ss
  endTime: string;
  title?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  minStaff?: number | null;
  maxStaff?: number | null;
  assignedEmployeeIds: string[];
  assignedEmployeeNames?: string[];
  taskTypeId?: string | null;
  preferredEmployeeIds?: string[] | null;  // "usually worked by" — preferred when eligible
}

// What a shift slot is for, and who may work it. Empty lists mean anyone.
export interface EngineTaskType {
  id: string;
  name: string;
  isBreak?: boolean | null;
  allowedWorkerTypeIds?: string[] | null;
  allowedEmployeeIds?: string[] | null;
}

export interface EngineWorkerType {
  id: string;
  name: string;
}

export interface EngineEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  isActive?: boolean | null;
  workerTypeId?: string | null;
  weeklyAvailability?: Record<string, { start: string; end: string } | undefined> | null;
}

export interface EngineTimeOff {
  employeeId?: string | null;
  startDate: string;
  endDate: string;
  status: string;             // pending | approved | denied
  leaveType?: string | null;
}

export interface EngineOverride {
  employeeId: string;
  date: string;
  isAvailable: boolean;
  altStartTime?: string | null;
  altEndTime?: string | null;
  reason?: string | null;
}

export interface EngineRule {
  name: string;
  ruleType: string;
  constraintType: 'hard' | 'soft';
  isEnabled: boolean;
  parameters?: Record<string, unknown> | null;
  scopeDepts?: string[] | null;
  scopeLocations?: string[] | null;
  scopeRoles?: string[] | null;
  scopeWorkerTypes?: string[] | null;
}

export interface EngineContext {
  shifts: EngineShift[];      // every shift in a window around the dates being checked
  timeOff: EngineTimeOff[];
  overrides: EngineOverride[];
  rules: EngineRule[];
  taskTypes?: EngineTaskType[];
  workerTypes?: EngineWorkerType[];
}

export type Severity = 'block' | 'warn';

export interface Conflict {
  code: string;
  severity: Severity;
  message: string;
  ruleName?: string;
}

// ── Rule metadata (shared with the Rules UI) ─────────────────────────────────

interface RuleParam { key: string; label: string; unit: string; defaultValue: number }

export const RULE_PARAMS: Record<string, RuleParam> = {
  MAX_HOURS_DAY:        { key: 'hours', label: 'Max hours per day',            unit: 'hours', defaultValue: 12 },
  MAX_HOURS_WEEK:       { key: 'hours', label: 'Max hours per week',           unit: 'hours', defaultValue: 40 },
  MIN_REST_BETWEEN:     { key: 'hours', label: 'Minimum rest between shifts',  unit: 'hours', defaultValue: 10 },
  MAX_CONSECUTIVE_DAYS: { key: 'days',  label: 'Max consecutive working days', unit: 'days',  defaultValue: 6 },
  MINIMIZE_OVERTIME:    { key: 'hours', label: 'Overtime starts after',        unit: 'hours', defaultValue: 40 },
  MIN_STAFFING:         { key: 'count', label: 'Minimum people per shift',     unit: 'people', defaultValue: 1 },
  MAX_STAFFING:         { key: 'count', label: 'Maximum people per shift',     unit: 'people', defaultValue: 5 },
};

const ENFORCED = new Set([
  ...Object.keys(RULE_PARAMS),
  'PREFER_AVAILABILITY', 'BALANCE_HOURS', 'BALANCE_WEEKENDS',
]);

// Rule types that need data TimeSync doesn't track yet (skills, certifications, …).
export function isRuleEnforced(ruleType: string): boolean {
  return ENFORCED.has(ruleType);
}

export function ruleValue(rule: Pick<EngineRule, 'ruleType' | 'parameters'>): number {
  const meta = RULE_PARAMS[rule.ruleType];
  const p = rule.parameters ?? {};
  // Older rules stored the threshold as a free-text `value`.
  const raw = (meta && p[meta.key]) ?? p.value ?? p.hours ?? p.days ?? p.count;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : meta?.defaultValue ?? 0;
}

// ── Time math ────────────────────────────────────────────────────────────────

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

// Absolute [start, end) in minutes; shifts ending at or before their start run past midnight.
function interval(s: Pick<EngineShift, 'date' | 'startTime' | 'endTime'>): [number, number] {
  const base = dayNumber(s.date) * 1440;
  const start = base + toMinutes(s.startTime);
  let end = base + toMinutes(s.endTime);
  if (end <= start) end += 1440;
  return [start, end];
}

export function shiftHours(s: Pick<EngineShift, 'date' | 'startTime' | 'endTime'>): number {
  const [a, b] = interval(s);
  return (b - a) / 60;
}

// ── Tasks ────────────────────────────────────────────────────────────────────

const taskIndex = new WeakMap<EngineTaskType[], Map<string, EngineTaskType>>();

export function taskOf(ctx: Pick<EngineContext, 'taskTypes'>, shift: Pick<EngineShift, 'taskTypeId'>): EngineTaskType | undefined {
  if (!shift.taskTypeId || !ctx.taskTypes) return undefined;
  let map = taskIndex.get(ctx.taskTypes);
  if (!map) { map = new Map(ctx.taskTypes.map(t => [t.id, t])); taskIndex.set(ctx.taskTypes, map); }
  return map.get(shift.taskTypeId);
}

export const isBreakShift = (ctx: Pick<EngineContext, 'taskTypes'>, shift: Pick<EngineShift, 'taskTypeId'>) =>
  !!taskOf(ctx, shift)?.isBreak;

// Hours that count toward daily/weekly limits; breaks don't.
export function workHours(ctx: Pick<EngineContext, 'taskTypes'>, s: EngineShift): number {
  return isBreakShift(ctx, s) ? 0 : shiftHours(s);
}

// Who may work a task: listed people always may; otherwise anyone of an
// allowed worker type. No lists at all means everyone.
export function canDoTask(task: EngineTaskType | undefined, emp: Pick<EngineEmployee, 'id' | 'workerTypeId'>): boolean {
  if (!task) return true;
  const types = task.allowedWorkerTypeIds ?? [];
  const people = task.allowedEmployeeIds ?? [];
  if (!types.length && !people.length) return true;
  return people.includes(emp.id) || (!!emp.workerTypeId && types.includes(emp.workerTypeId));
}

export function eligibilityLabel(task: EngineTaskType, workerTypes: EngineWorkerType[] = []): string {
  const names = (task.allowedWorkerTypeIds ?? [])
    .map(id => workerTypes.find(w => w.id === id)?.name)
    .filter(Boolean) as string[];
  const people = task.allowedEmployeeIds?.length ?? 0;
  if (!names.length && !people) return 'Anyone';
  const parts = names.length ? [names.join(' or ')] : [];
  if (people) parts.push(`${people} named ${people === 1 ? 'person' : 'people'}`);
  return parts.join(' + ');
}

function weekStartDay(iso: string): number {
  const n = dayNumber(iso);
  // 1970-01-01 was a Thursday; shift so weeks start on Sunday.
  return n - ((n + 4) % 7);
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DOW_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

function dayOfWeek(iso: string): number {
  return (dayNumber(iso) + 4) % 7;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ── Checks ───────────────────────────────────────────────────────────────────

function ruleApplies(rule: EngineRule, shift: EngineShift, emp: EngineEmployee): boolean {
  if (!rule.isEnabled) return false;
  if (rule.scopeDepts?.length && !rule.scopeDepts.includes(shift.departmentId ?? '')) return false;
  if (rule.scopeLocations?.length && !rule.scopeLocations.includes(shift.locationId ?? '')) return false;
  if (rule.scopeRoles?.length && !rule.scopeRoles.includes(emp.role ?? '')) return false;
  if (rule.scopeWorkerTypes?.length && !rule.scopeWorkerTypes.includes(emp.workerTypeId ?? '')) return false;
  return true;
}

const severityOf = (rule: EngineRule): Severity => (rule.constraintType === 'hard' ? 'block' : 'warn');

// Per-employee shift lists, kept by autoFill so large pre-set weeks stay fast.
type IndexedContext = EngineContext & { byEmployee?: Map<string, EngineShift[]> };

export function employeeShifts(ctx: EngineContext, employeeId: string, excludeShiftId?: string): EngineShift[] {
  const indexed = (ctx as IndexedContext).byEmployee;
  const list = indexed ? indexed.get(employeeId) ?? [] : ctx.shifts.filter(s => s.assignedEmployeeIds.includes(employeeId));
  return excludeShiftId ? list.filter(s => s.id !== excludeShiftId) : list;
}

export function weekHours(ctx: EngineContext, employeeId: string, isoInWeek: string, excludeShiftId?: string): number {
  const ws = weekStartDay(isoInWeek);
  return employeeShifts(ctx, employeeId, excludeShiftId)
    .filter(s => weekStartDay(s.date) === ws)
    .reduce((sum, s) => sum + workHours(ctx, s), 0);
}

export function checkAssignment(shift: EngineShift, emp: EngineEmployee, ctx: EngineContext): Conflict[] {
  const out: Conflict[] = [];
  const name = `${emp.firstName} ${emp.lastName}`.trim();

  if (emp.isActive === false) {
    out.push({ code: 'INACTIVE', severity: 'block', message: `${name} is no longer active.` });
  }
  if (shift.assignedEmployeeIds.includes(emp.id)) {
    out.push({ code: 'ALREADY_ASSIGNED', severity: 'block', message: `${name} is already on this shift.` });
    return out;
  }
  if (shift.maxStaff && shift.assignedEmployeeIds.length >= shift.maxStaff) {
    out.push({ code: 'SHIFT_FULL', severity: 'block', message: `This shift is full (max ${shift.maxStaff}).` });
  }

  const task = taskOf(ctx, shift);
  if (task && !canDoTask(task, emp)) {
    out.push({ code: 'TASK_ELIGIBILITY', severity: 'block',
      message: `${task.name} is limited to ${eligibilityLabel(task, ctx.workerTypes)}.` });
  }

  const [start, end] = interval(shift);
  const hours = workHours(ctx, shift);
  const mine = employeeShifts(ctx, emp.id, shift.id);

  // A break belongs to someone working right before or after it.
  if (task?.isBreak && !mine.some(o => !isBreakShift(ctx, o) && (interval(o)[1] === start || interval(o)[0] === end))) {
    out.push({ code: 'BREAK_NOT_ON_SHIFT', severity: 'warn',
      message: `${name} isn't working right before or after this break.` });
  }

  // Double-booking is never allowed.
  for (const other of mine) {
    const [os, oe] = interval(other);
    if (start < oe && os < end) {
      out.push({
        code: 'DOUBLE_BOOKED', severity: 'block',
        message: `Already working ${other.title || 'a shift'} ${other.startTime.slice(0, 5)}–${other.endTime.slice(0, 5)} that day.`,
      });
    }
  }

  // Approved time off blocks; pending time off is worth knowing about.
  for (const t of ctx.timeOff) {
    if (t.employeeId !== emp.id || t.status === 'denied') continue;
    if (shift.date >= t.startDate && shift.date <= t.endDate) {
      out.push(t.status === 'approved'
        ? { code: 'TIME_OFF', severity: 'block', message: `On approved time off (${t.leaveType ?? 'leave'}).` }
        : { code: 'TIME_OFF_PENDING', severity: 'warn', message: `Has a pending time-off request for this day.` });
    }
  }

  const rules = ctx.rules.filter(r => ruleApplies(r, shift, emp));
  const byType = (t: string) => rules.filter(r => r.ruleType === t);

  // Availability: governed by PREFER_AVAILABILITY. Disabled rule → skip;
  // no such rule at all → warn so the admin still sees it.
  const availRule = ctx.rules.find(r => r.ruleType === 'PREFER_AVAILABILITY');
  if (!availRule || ruleApplies(availRule, shift, emp)) {
    const sev: Severity = availRule ? severityOf(availRule) : 'warn';
    const issue = availabilityIssue(shift, emp, ctx);
    if (issue) out.push({ code: 'AVAILABILITY', severity: sev, message: issue, ruleName: availRule?.name });
  }

  for (const r of byType('MAX_HOURS_DAY')) {
    const limit = ruleValue(r);
    const total = mine.filter(s => s.date === shift.date).reduce((a, s) => a + workHours(ctx, s), 0) + hours;
    if (total > limit) {
      out.push({ code: 'MAX_HOURS_DAY', severity: severityOf(r), ruleName: r.name,
        message: `Would work ${fmt(total)}h that day (limit ${fmt(limit)}h).` });
    }
  }

  const week = weekHours(ctx, emp.id, shift.date, shift.id) + hours;
  for (const r of byType('MAX_HOURS_WEEK')) {
    const limit = ruleValue(r);
    if (week > limit) {
      out.push({ code: 'MAX_HOURS_WEEK', severity: severityOf(r), ruleName: r.name,
        message: `Would work ${fmt(week)}h this week (limit ${fmt(limit)}h).` });
    }
  }
  for (const r of byType('MINIMIZE_OVERTIME')) {
    const limit = ruleValue(r);
    if (week > limit) {
      out.push({ code: 'OVERTIME', severity: severityOf(r), ruleName: r.name,
        message: `Puts them into overtime (${fmt(week)}h this week).` });
    }
  }

  // Rest is measured between working days; back-to-back tasks and split
  // shifts on the same day are one stretch of work.
  for (const r of byType('MIN_REST_BETWEEN')) {
    const minRest = ruleValue(r) * 60;
    for (const other of mine) {
      if (other.date === shift.date) continue;
      const [os, oe] = interval(other);
      const gap = os >= end ? os - end : start >= oe ? start - oe : -1;
      if (gap >= 0 && gap < minRest) {
        out.push({ code: 'MIN_REST', severity: severityOf(r), ruleName: r.name,
          message: `Only ${fmt(gap / 60)}h rest next to their ${other.date} shift (needs ${fmt(minRest / 60)}h).` });
      }
    }
  }

  for (const r of byType('MAX_CONSECUTIVE_DAYS')) {
    const limit = ruleValue(r);
    const days = new Set(mine.map(s => dayNumber(s.date)));
    const d = dayNumber(shift.date);
    let run = 1;
    for (let i = d - 1; days.has(i); i--) run++;
    for (let i = d + 1; days.has(i); i++) run++;
    if (run > limit) {
      out.push({ code: 'MAX_CONSECUTIVE_DAYS', severity: severityOf(r), ruleName: r.name,
        message: `Would be ${run} days in a row (limit ${fmt(limit)}).` });
    }
  }

  for (const r of byType('MAX_STAFFING')) {
    const limit = ruleValue(r);
    if (shift.assignedEmployeeIds.length + 1 > limit) {
      out.push({ code: 'MAX_STAFFING', severity: severityOf(r), ruleName: r.name,
        message: `Shift would have ${shift.assignedEmployeeIds.length + 1} people (limit ${fmt(limit)}).` });
    }
  }

  return out;
}

function availabilityIssue(shift: EngineShift, emp: EngineEmployee, ctx: EngineContext): string | null {
  const [start, end] = [toMinutes(shift.startTime), toMinutes(shift.endTime)];
  const override = ctx.overrides.find(o => o.employeeId === emp.id && o.date === shift.date);
  if (override) {
    if (!override.isAvailable) return `Marked unavailable this day${override.reason ? ` (${override.reason})` : ''}.`;
    if (override.altStartTime && override.altEndTime &&
        (start < toMinutes(override.altStartTime) || end > toMinutes(override.altEndTime))) {
      return `Only available ${override.altStartTime.slice(0, 5)}–${override.altEndTime.slice(0, 5)} that day.`;
    }
    return null;
  }
  const avail = emp.weeklyAvailability;
  if (!avail || Object.keys(avail).length === 0) return null;   // never set → no constraint
  const day = avail[DOW_KEYS[dayOfWeek(shift.date)]];
  if (!day || !day.start) return `Not available on ${DOW_NAMES[dayOfWeek(shift.date)]}.`;
  const endsNextDay = toMinutes(shift.endTime) <= toMinutes(shift.startTime);
  if (start < toMinutes(day.start) || endsNextDay || end > toMinutes(day.end)) {
    return `Outside their availability (${day.start}–${day.end}).`;
  }
  return null;
}

export function worstSeverity(conflicts: Conflict[]): 'ok' | Severity {
  if (conflicts.some(c => c.severity === 'block')) return 'block';
  return conflicts.length ? 'warn' : 'ok';
}

// ── Staffing targets ─────────────────────────────────────────────────────────

export function staffTarget(shift: EngineShift, rules: EngineRule[]): number {
  let target = shift.minStaff ?? 1;
  for (const r of rules) {
    if (r.ruleType !== 'MIN_STAFFING' || !r.isEnabled) continue;
    if (r.scopeDepts?.length && !r.scopeDepts.includes(shift.departmentId ?? '')) continue;
    if (r.scopeLocations?.length && !r.scopeLocations.includes(shift.locationId ?? '')) continue;
    target = Math.max(target, ruleValue(r));
  }
  return shift.maxStaff ? Math.min(target, shift.maxStaff) : target;
}

// ── Auto-scheduling ──────────────────────────────────────────────────────────

export interface AutoFillResult {
  // Final assignment lists for every shift that changed.
  changes: { shiftId: string; employeeIds: string[]; employeeNames: string[]; added: string[] }[];
  unfilled: { shiftId: string; label: string; missing: number; reason: string }[];
  assignedCount: number;
}

// Greedy fill, earliest shifts first. For each open slot pick the eligible
// employee with no blocking conflicts, scoring (lower wins):
//   warnings, hours that week and that day, weekend load (BALANCE_WEEKENDS),
//   overlapping restricted slots they'd be needed for, minus a bonus for the
//   slot's "usually worked by" people and for picking up right where their
//   previous task ends (so pre-set days become continuous blocks instead of
//   scattered hours).
// Break slots go only to someone working right before or after the break.
export function autoFill(targets: EngineShift[], employees: EngineEmployee[], ctx: EngineContext): AutoFillResult {
  const work: IndexedContext = {
    ...ctx,
    shifts: ctx.shifts.map(s => ({ ...s, assignedEmployeeIds: [...s.assignedEmployeeIds], assignedEmployeeNames: [...(s.assignedEmployeeNames ?? [])] })),
    byEmployee: new Map(),
  };
  const byId = new Map(work.shifts.map(s => [s.id, s]));
  const index = (s: EngineShift, empId: string) => {
    const list = work.byEmployee!.get(empId);
    if (list) list.push(s); else work.byEmployee!.set(empId, [s]);
  };

  const balanceWeekends = ctx.rules.some(r => r.ruleType === 'BALANCE_WEEKENDS' && r.isEnabled);
  const active = employees.filter(e => e.isActive !== false);
  const result: AutoFillResult = { changes: [], unfilled: [], assignedCount: 0 };

  // Who could ever do each slot (task eligibility only). Slots few people can
  // do go first among those starting together, and while they're open their
  // people are kept free for them where someone else can cover.
  const eligible = new Map(targets.map(t => [t.id, active.filter(e => canDoTask(taskOf(ctx, t), e)).length]));
  const isBreak = (s: EngineShift) => isBreakShift(ctx, s);
  // A break goes ahead of work starting at the same moment, so whoever just
  // finished a block takes it before being chained into the next one.
  const ordered = targets
    .map(t => byId.get(t.id) ?? { ...t, assignedEmployeeIds: [...t.assignedEmployeeIds], assignedEmployeeNames: [...(t.assignedEmployeeNames ?? [])] })
    .sort((a, b) => interval(a)[0] - interval(b)[0] || Number(isBreak(b)) - Number(isBreak(a))
      || eligible.get(a.id)! - eligible.get(b.id)! || a.id.localeCompare(b.id));
  for (const s of ordered) if (!byId.has(s.id)) { work.shifts.push(s); byId.set(s.id, s); }
  for (const s of work.shifts) for (const id of s.assignedEmployeeIds) index(s, id);
  const changed = new Map<string, string[]>();

  const restricted = ordered.filter(s => !isBreak(s) && eligible.get(s.id)! < active.length);
  const overlapping = (s: EngineShift) => {
    const [a, b] = interval(s);
    return restricted.filter(o => o !== s && o.date === s.date && interval(o)[0] < b && a < interval(o)[1]);
  };
  const scarcity = (shift: EngineShift, emp: EngineEmployee) => overlapping(shift)
    .filter(o => o.assignedEmployeeIds.length < staffTarget(o, ctx.rules) && canDoTask(taskOf(ctx, o), emp))
    .reduce((sum, o) => sum + 400 / Math.max(1, eligible.get(o.id)!), 0);

  const score = (shift: EngineShift, emp: EngineEmployee, conflicts: Conflict[]): number | null => {
    const [start, end] = interval(shift);
    const sameDay = employeeShifts(work, emp.id).filter(s => s.date === shift.date);
    const worked = sameDay.filter(s => !isBreak(s));
    const before = worked.some(s => interval(s)[1] === start);
    const after = worked.some(s => interval(s)[0] === end);
    const dayHours = sameDay.reduce((a, s) => a + workHours(work, s), 0);

    if (isBreak(shift)) {
      if (!before && !after) return null;
      const breaksToday = sameDay.filter(isBreak).length;
      // Someone working through the break, with the longest day and no break
      // yet, gets it first.
      return conflicts.length * 1000 + breaksToday * 300 - (before && after ? 200 : 0) - dayHours * 10;
    }
    // Picking up within half an hour (e.g. after a break slot) still counts.
    const adjacent = before || after || worked.some(s => {
      const [a, b] = interval(s);
      return (start - b >= 0 && start - b <= 30) || (a - end >= 0 && a - end <= 30);
    });
    const weekendLoad = balanceWeekends
      ? employeeShifts(work, emp.id).filter(s => [0, 6].includes(dayOfWeek(s.date))).length
      : 0;
    const preferred = shift.preferredEmployeeIds?.includes(emp.id) ? 500 : 0;
    const flow = adjacent ? 150 : sameDay.length ? -100 : 0;   // continue a block; avoid split days
    return conflicts.length * 1000 + weekHours(work, emp.id, shift.date) * 10 + dayHours * 8
      + weekendLoad * 50 + scarcity(shift, emp) - preferred - flow;
  };

  {
    for (const shift of ordered) {
      const target = staffTarget(shift, ctx.rules);
      let lastReasons: Conflict[] = [];

      while (shift.assignedEmployeeIds.length < target) {
        let best: { emp: EngineEmployee; score: number } | null = null;
        const blockers: Conflict[] = [];
        let offShift = false;   // someone could have taken this break but isn't working next to it
        for (const emp of active) {
          const conflicts = checkAssignment(shift, emp, work);
          if (worstSeverity(conflicts) === 'block') { blockers.push(...conflicts.filter(c => c.severity === 'block')); continue; }
          const value = score(shift, emp, conflicts.filter(c => c.code !== 'BREAK_NOT_ON_SHIFT'));
          if (value === null) { offShift = true; continue; }
          if (!best || value < best.score) best = { emp, score: value };
        }
        if (!best) {
          lastReasons = offShift ? [{ code: 'BREAK_NOT_ON_SHIFT', severity: 'warn', message: '' }] : blockers;
          break;
        }
        shift.assignedEmployeeIds.push(best.emp.id);
        shift.assignedEmployeeNames = [...(shift.assignedEmployeeNames ?? []), `${best.emp.firstName} ${best.emp.lastName}`.trim()];
        index(shift, best.emp.id);
        changed.set(shift.id, [...(changed.get(shift.id) ?? []), best.emp.id]);
        result.assignedCount++;
      }

      const missing = target - shift.assignedEmployeeIds.length;
      if (missing > 0) {
        result.unfilled.push({
          shiftId: shift.id,
          label: `${shift.title || 'Shift'} · ${shift.date} ${shift.startTime.slice(0, 5)}`,
          missing,
          reason: active.length === 0 ? 'No active employees.' : mostCommon(lastReasons) ?? 'No one is eligible.',
        });
      }
    }
  }

  for (const shift of ordered) {
    const added = changed.get(shift.id);
    if (added) {
      result.changes.push({
        shiftId: shift.id,
        employeeIds: shift.assignedEmployeeIds,
        employeeNames: shift.assignedEmployeeNames ?? [],
        added,
      });
    }
  }
  return result;
}

function mostCommon(conflicts: Conflict[]): string | null {
  if (!conflicts.length) return null;
  const counts = new Map<string, number>();
  for (const c of conflicts) counts.set(c.code, (counts.get(c.code) ?? 0) + 1);
  const [code] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const labels: Record<string, string> = {
    DOUBLE_BOOKED: 'Everyone eligible is already working then.',
    TIME_OFF: 'Remaining staff are on time off.',
    AVAILABILITY: 'No one else is available then.',
    MAX_HOURS_WEEK: 'Everyone else would exceed the weekly hour cap.',
    MAX_HOURS_DAY: 'Everyone else would exceed the daily hour cap.',
    MIN_REST: 'Everyone else would get too little rest.',
    MAX_CONSECUTIVE_DAYS: 'Everyone else would work too many days in a row.',
    OVERTIME: 'Everyone else would go into overtime.',
    SHIFT_FULL: 'Shift reached its maximum staff.',
    MAX_STAFFING: 'Shift reached its maximum staff.',
    TASK_ELIGIBILITY: 'No one else is allowed to do this task.',
    BREAK_NOT_ON_SHIFT: 'No one is working right before or after this break.',
  };
  return labels[code] ?? conflicts.find(c => c.code === code)!.message;
}
