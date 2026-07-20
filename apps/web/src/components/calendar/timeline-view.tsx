'use client';

import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/store';
import type { Shift } from '@/types';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { Plus } from 'lucide-react';

interface TimelineViewProps {
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onCreateShift?: (date: string) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm
const DAY_START = 6 * 60;
const DAY_SPAN  = 18 * 60;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function pctLeft(minutes: number) {
  return Math.max(0, ((minutes - DAY_START) / DAY_SPAN) * 100);
}
function pctWidth(startMin: number, endMin: number) {
  const clampedStart = Math.max(startMin, DAY_START);
  const clampedEnd   = Math.min(endMin, DAY_START + DAY_SPAN);
  return Math.max(0.5, ((clampedEnd - clampedStart) / DAY_SPAN) * 100);
}

export function TimelineView({ shifts, onShiftClick, onCreateShift }: TimelineViewProps) {
  const { currentDate } = useCalendarStore();
  const pivot = parseISO(currentDate + 'T00:00:00');
  const weekStart = startOfWeek(pivot, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group shifts by department (or "Unassigned")
  const deptMap: Record<string, { color: string; rows: { day: string; shift: Shift }[] }> = {};
  for (const shift of shifts) {
    const key = shift.department?.name ?? 'Unassigned';
    if (!deptMap[key]) {
      deptMap[key] = { color: shift.color ?? '#6366f1', rows: [] };
    }
    deptMap[key].rows.push({ day: shift.date, shift });
  }
  const departments = Object.entries(deptMap).sort(([a], [b]) => a.localeCompare(b));

  const COL_W = 160; // px per day column
  const ROW_H = 52;  // px per department row

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-auto">

        {/* Left label column */}
        <div className="flex-shrink-0 w-40 border-r border-gray-200 bg-white z-10 sticky left-0">
          {/* Top-left corner — aligns with the hour header row */}
          <div className="h-10 border-b border-gray-200 flex items-center px-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Department</span>
          </div>
          {departments.length === 0 ? (
            <div className="py-8 px-3 text-xs text-gray-400">No shifts this week</div>
          ) : (
            departments.map(([name, { color }]) => (
              <div key={name} style={{ height: ROW_H }} className="border-b border-gray-100 flex items-center px-3 gap-2">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium text-gray-700 truncate">{name}</span>
              </div>
            ))
          )}
        </div>

        {/* Scrollable timeline grid */}
        <div className="flex-1 overflow-x-auto">
          {/* Per-day columns */}
          <div style={{ minWidth: days.length * COL_W }}>

            {/* Day header row */}
            <div className="flex h-10 border-b border-gray-200 sticky top-0 bg-white z-10">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                return (
                  <div key={dateStr} style={{ width: COL_W }} className="border-r border-gray-100 flex flex-col items-center justify-center">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide', isToday ? 'text-indigo-600' : 'text-gray-400')}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={cn('text-xs font-bold', isToday ? 'text-indigo-700' : 'text-gray-700')}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hour tick marks overlaid on each row */}
            {departments.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                No shifts scheduled for this week
              </div>
            ) : (
              departments.map(([name, { rows }]) => (
                <div key={name} className="flex border-b border-gray-100" style={{ height: ROW_H }}>
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayShifts = rows.filter(r => r.day === dateStr).map(r => r.shift);
                    const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

                    return (
                      <div key={dateStr}
                        style={{ width: COL_W }}
                        className={cn('relative border-r border-gray-100 flex-shrink-0 group', isToday && 'bg-indigo-50/20')}
                        onClick={() => onCreateShift?.(dateStr)}
                      >
                        {/* Hour grid lines */}
                        {HOURS.filter((_, i) => i % 3 === 0).map((h, i) => (
                          <div key={h}
                            className="absolute top-0 bottom-0 border-l border-gray-100"
                            style={{ left: `${((h * 60 - DAY_START) / DAY_SPAN) * 100}%` }}
                          />
                        ))}

                        {/* Shift bars */}
                        {dayShifts.map(shift => {
                          const startMin = timeToMinutes(shift.startTime);
                          const endMin   = timeToMinutes(shift.endTime);
                          const left  = pctLeft(startMin);
                          const width = pctWidth(startMin, endMin);
                          const color = shift.color ?? '#6366f1';

                          return (
                            <div
                              key={shift.id}
                              onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                              className="absolute top-2 rounded cursor-pointer hover:shadow-sm hover:opacity-90 transition-all overflow-hidden"
                              style={{
                                left:   `${left}%`,
                                width:  `${width}%`,
                                height: ROW_H - 16,
                                backgroundColor: `${color}22`,
                                borderLeft: `3px solid ${color}`,
                              }}
                              title={`${shift.title ?? 'Shift'} · ${shift.startTime.slice(0,5)}–${shift.endTime.slice(0,5)}`}
                            >
                              <div className="px-1.5 py-1 h-full flex flex-col justify-center overflow-hidden">
                                <p className="text-[10px] font-semibold truncate leading-tight" style={{ color }}>
                                  {shift.title ?? 'Shift'}
                                </p>
                                <p className="text-[9px] text-gray-500 truncate leading-tight">
                                  {shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)}
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add button on hover */}
                        {dayShifts.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={14} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Hour legend at bottom */}
      <div className="border-t border-gray-100 flex overflow-x-auto bg-gray-50/60">
        <div className="w-40 flex-shrink-0 px-3 py-1.5 flex items-center">
          <span className="text-[10px] text-gray-400">Time →</span>
        </div>
        <div className="flex" style={{ minWidth: days.length * COL_W }}>
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return (
              <div key={dateStr} style={{ width: COL_W }} className="relative border-r border-gray-100">
                <div className="relative h-5 w-full">
                  {HOURS.filter((_, i) => i % 3 === 0).map(h => {
                    const left = pctLeft(h * 60);
                    return (
                      <span key={h} className="absolute text-[9px] text-gray-300 -translate-x-1/2" style={{ left: `${left}%`, top: 2 }}>
                        {h > 12 ? `${h-12}p` : h === 12 ? '12p' : `${h}a`}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
