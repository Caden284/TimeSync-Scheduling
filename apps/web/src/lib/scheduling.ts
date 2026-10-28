'use client';

import type { Shift, ShiftAssignment, EmployeeSummary } from '@/types';
import { getShifts, getEmployees, getRules, getTimeOffInRange, getAvailabilityOverrides, getTaskTypes, getWorkerTypes } from './db';
import { addDaysISO } from './dates';
import { generateColor } from './utils';
import { shiftHours, type EngineContext, type EngineEmployee, type EngineShift } from './rule-engine';

// ── Database row → calendar Shift ────────────────────────────────────────────

export function rowToShift(doc: any, employeeColors?: Map<string, string>): Shift {
  const ids: string[] = doc.assignedEmployeeIds ?? [];
  const names: string[] = doc.assignedEmployeeNames ?? [];
  const assignments: ShiftAssignment[] = ids.map((employeeId, i) => {
    const [firstName, ...rest] = (names[i] ?? 'Unknown').split(' ');
    return {
      id: `${doc.id}:${employeeId}`,
      shiftId: doc.id,
      employeeId,
      status: 'assigned',
      assignedBy: 'manual',
      employee: {
        id: employeeId,
        firstName,
        lastName: rest.join(' '),
        displayColor: employeeColors?.get(employeeId) ?? generateColor(employeeId),
      } as EmployeeSummary,
    };
  });
  const startTime = doc.startTime ?? '00:00:00';
  const endTime = doc.endTime ?? '00:00:00';
  return {
    id: doc.id,
    orgId: doc.orgId,
    scheduleId: doc.scheduleId ?? undefined,
    templateId: doc.templateId ?? undefined,
    title: doc.title ?? undefined,
    date: doc.date,
    startTime,
    endTime,
    startDatetime: `${doc.date}T${startTime}`,
    endDatetime: `${doc.date}T${endTime}`,
    durationHours: shiftHours({ date: doc.date, startTime, endTime }),
    crossesMidnight: endTime.slice(0, 5) <= startTime.slice(0, 5),
    breakMinutes: 0,
    requiredSkills: [],
    requiredCerts: [],
    shiftType: doc.shiftType ?? 'fixed',
    status: doc.status ?? 'scheduled',
    isOpen: doc.isOpen ?? ids.length < (doc.minStaff ?? 1),
    minStaff: doc.minStaff ?? 1,
    maxStaff: doc.maxStaff ?? undefined,
    color: doc.color ?? '#6366f1',
    notes: doc.notes ?? undefined,
    departmentId: doc.departmentId ?? undefined,
    locationId: doc.locationId ?? undefined,
    assignments,
    assignedEmployeeIds: ids,
    assignedEmployeeNames: names,
    taskTypeId: doc.taskTypeId ?? undefined,
    preferredEmployeeIds: doc.preferredEmployeeIds ?? [],
    metadata: {},
    createdAt: doc.createdAt,
    department: doc.departmentId || doc.departmentName
      ? { id: doc.departmentId ?? '', name: doc.departmentName ?? '', color: doc.departmentColor ?? '#6366f1', orgId: doc.orgId, isActive: true } as any
      : undefined,
    location: doc.locationId || doc.locationName
      ? { id: doc.locationId ?? '', name: doc.locationName ?? '', orgId: doc.orgId, isActive: true } as any
      : undefined,
  };
}

export function toEngineShift(s: Shift | any): EngineShift {
  return {
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    title: s.title,
    departmentId: s.departmentId,
    locationId: s.locationId,
    minStaff: s.minStaff,
    maxStaff: s.maxStaff,
    assignedEmployeeIds: s.assignedEmployeeIds ?? s.assignments?.map((a: ShiftAssignment) => a.employeeId) ?? [],
    assignedEmployeeNames: s.assignedEmployeeNames ?? [],
    taskTypeId: s.taskTypeId ?? null,
    preferredEmployeeIds: s.preferredEmployeeIds ?? [],
  };
}

export function toEngineEmployee(e: any): EngineEmployee {
  return {
    id: e.id,
    firstName: e.firstName ?? '',
    lastName: e.lastName ?? '',
    role: e.role,
    isActive: e.isActive,
    workerTypeId: e.workerTypeId ?? null,
    weeklyAvailability: e.weeklyAvailability,
  };
}

// Everything the rule engine needs to judge assignments for shifts between
// `from` and `to`. Loads a week either side so rest periods, consecutive
// days, and weekly hours that straddle the range are counted.
export async function loadSchedulingContext(orgId: string, from: string, to: string) {
  const wFrom = addDaysISO(from, -7);
  const wTo = addDaysISO(to, 7);
  const [shiftRows, employees, rules, timeOff, overrides, taskTypes, workerTypes] = await Promise.all([
    getShifts(orgId, wFrom, wTo),
    getEmployees(orgId),
    getRules(orgId),
    getTimeOffInRange(orgId, wFrom, wTo),
    getAvailabilityOverrides(orgId, wFrom, wTo),
    getTaskTypes(orgId).catch(() => []),
    getWorkerTypes(orgId).catch(() => []),
  ]);
  const ctx: EngineContext = {
    shifts: shiftRows.map(toEngineShift),
    timeOff: timeOff.map((t: any) => ({ employeeId: t.employeeId, startDate: t.startDate, endDate: t.endDate, status: t.status, leaveType: t.leaveType })),
    overrides: overrides.map((o: any) => ({ employeeId: o.employeeId, date: o.date, isAvailable: o.isAvailable, altStartTime: o.altStartTime, altEndTime: o.altEndTime, reason: o.reason })),
    rules: rules.map(r => ({ ...r, constraintType: r.constraintType })),
    taskTypes,
    workerTypes,
  };
  return { ctx, employees, engineEmployees: employees.map(toEngineEmployee) };
}
