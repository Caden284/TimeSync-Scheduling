'use client';

import type { Season, ShiftTemplate, TaskType } from '@/types';
import { createShifts, getSeasons, getShiftTemplates, getTaskTypes } from './db';
import { addDaysISO, parseISODate } from './dates';

// A pre-set schedule is a season's slots (shift templates): fixed task times
// on certain weekdays, possibly overlapping. Generating turns them into dated,
// unassigned shifts; Auto-Schedule then picks who works each one.

export function presetRows(
  orgId: string,
  templates: ShiftTemplate[],
  taskTypes: TaskType[],
  from: string,
  to: string,
): Record<string, unknown>[] {
  const tasks = new Map(taskTypes.map(t => [t.id, t]));
  // Every row in one insert needs the same columns; task columns are only
  // included when the pre-set uses them (they need the tasks migration).
  const withTasks = templates.some(t => t.taskTypeId || t.preferredEmployeeIds?.length);
  const rows: Record<string, unknown>[] = [];
  for (let date = from; date <= to; date = addDaysISO(date, 1)) {
    const dow = parseISODate(date).getDay();
    for (const t of templates) {
      if (!t.isActive || !t.daysOfWeek.includes(dow)) continue;
      const task = t.taskTypeId ? tasks.get(t.taskTypeId) : undefined;
      const color = t.color || task?.color || '#6366f1';
      rows.push({
        orgId, templateId: t.id, date,
        title: t.name || task?.name || 'Shift',
        startTime: t.startTime, endTime: t.endTime,
        departmentId: t.departmentId ?? null, departmentName: t.departmentName ?? null, departmentColor: color,
        ...(withTasks ? { taskTypeId: t.taskTypeId ?? null, preferredEmployeeIds: t.preferredEmployeeIds ?? [] } : {}),
        shiftType: 'fixed', status: 'open', isOpen: true,
        minStaff: t.minStaff, color, notes: t.notes ?? null,
      });
    }
  }
  return rows;
}

// Creates this range's slots from every season that covers it (each day uses
// the season it falls in). Slots that already exist are skipped, so it's safe
// to run again after editing the pre-set.
export async function generateFromPresets(orgId: string, from: string, to: string) {
  const [seasons, taskTypes] = await Promise.all([getSeasons(orgId), getTaskTypes(orgId).catch(() => [])]);
  const covering = (seasons as Season[]).filter(s => s.startDate <= to && s.endDate >= from);
  let rows: Record<string, unknown>[] = [];
  for (const season of covering) {
    const templates = await getShiftTemplates(orgId, season.id) as ShiftTemplate[];
    const a = season.startDate > from ? season.startDate : from;
    const b = season.endDate < to ? season.endDate : to;
    rows = rows.concat(presetRows(orgId, templates, taskTypes, a, b));
  }
  // Seasons may differ in whether they use tasks; give every row the same columns.
  if (rows.some(r => 'taskTypeId' in r)) rows = rows.map(r => ({ taskTypeId: null, preferredEmployeeIds: [], ...r }));
  const created = await createShifts(rows);
  return { created, skipped: rows.length - created, seasons: covering.map(s => s.name) };
}
