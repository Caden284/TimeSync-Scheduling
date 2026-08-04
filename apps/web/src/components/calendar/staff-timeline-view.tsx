'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useCalendarStore } from '@/store';
import type { Shift } from '@/types';

const DAY_START = 6 * 60;  // 6:00 AM in minutes
const DAY_END   = 23 * 60; // 11:00 PM in minutes
const DAY_SPAN  = DAY_END - DAY_START;

const HOUR_LABELS = Array.from({ length: 18 }, (_, i) => {
  const h = 6 + i;
  return { label: h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`, pct: ((h * 60 - DAY_START) / DAY_SPAN) * 100 };
});

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function pctLeft(time: string) {
  return `${Math.max(0, Math.min(100, ((timeToMinutes(time) - DAY_START) / DAY_SPAN) * 100))}%`;
}

function pctWidth(start: string, end: string) {
  const s = Math.max(timeToMinutes(start), DAY_START);
  const e = Math.min(timeToMinutes(end), DAY_END);
  return `${Math.max(1, ((e - s) / DAY_SPAN) * 100)}%`;
}

interface Props {
  shifts: Shift[];
  onShiftClick?: (shift: Shift) => void;
}

export function StaffTimelineView({ shifts, onShiftClick }: Props) {
  const { currentDate } = useCalendarStore();

  const dayShifts = useMemo(() => {
    return shifts.filter(s => s.date === currentDate);
  }, [shifts, currentDate]);

  // Build employee color map
  const employeeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    dayShifts.forEach(s => {
      s.assignments?.forEach(a => {
        const name = a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '';
        if (name && !map.has(name)) { map.set(name, COLORS[idx % COLORS.length]); idx++; }
      });
      (s as any).assignedEmployeeNames?.forEach((name: string) => {
        if (name && !map.has(name)) { map.set(name, COLORS[idx % COLORS.length]); idx++; }
      });
    });
    return map;
  }, [dayShifts]);

  // Group by shift title (template name)
  const rows = useMemo(() => {
    const map = new Map<string, Shift[]>();
    dayShifts.forEach(s => {
      const key = s.title ?? 'Untitled Shift';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [dayShifts]);

  const parsedDate = parseISO(currentDate + 'T00:00:00');
  const dateLabel = format(parsedDate, 'EEEE, MMMM d, yyyy');

  if (dayShifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
        <div className="text-4xl">📋</div>
        <p className="text-sm font-medium">No shifts on {format(parsedDate, 'MMMM d')}</p>
        <p className="text-xs">Create shifts or generate from a season template to see them here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Date header */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{dateLabel}</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</span>
          <span>{dayShifts.filter(s => !s.isOpen && ((s as any).assignedEmployeeNames?.length > 0 || s.assignments?.length > 0)).length} filled</span>
          <span className="text-amber-600">{dayShifts.filter(s => s.isOpen || (!(s as any).assignedEmployeeNames?.length && !s.assignments?.length)).length} unfilled</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Time axis header */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="w-44 shrink-0 border-r border-gray-100 py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Shift / Position
            </div>
            <div className="flex-1 relative h-9">
              {HOUR_LABELS.map(h => (
                <div
                  key={h.label}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${h.pct}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap pt-2">{h.label}</span>
                  <div className="h-2 w-px bg-gray-200 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {rows.map(([title, rowShifts]) => (
            <div key={title} className="flex border-b border-gray-50 hover:bg-gray-50/50 group">
              {/* Label */}
              <div className="w-44 shrink-0 border-r border-gray-100 py-3 px-4">
                <p className="text-xs font-semibold text-gray-700 truncate">{title}</p>
                {rowShifts[0]?.department?.name && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{rowShifts[0].department.name}</p>
                )}
              </div>

              {/* Timeline lane */}
              <div className="flex-1 relative" style={{ height: 56 }}>
                {/* Hour grid lines */}
                {HOUR_LABELS.map(h => (
                  <div
                    key={h.label}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${h.pct}%` }}
                  />
                ))}

                {rowShifts.map(shift => {
                  const assignedNames: string[] = (shift as any).assignedEmployeeNames ?? shift.assignments?.map(a => a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '').filter(Boolean) ?? [];
                  const isFilled = assignedNames.length > 0;

                  return (
                    <button
                      key={shift.id}
                      onClick={() => onShiftClick?.(shift)}
                      title={`${shift.startTime.slice(0,5)}–${shift.endTime.slice(0,5)} · ${isFilled ? assignedNames.join(', ') : 'Unfilled'}`}
                      className="absolute top-2.5 bottom-2.5 rounded-md flex items-center px-2 text-xs font-medium transition-all hover:brightness-95 overflow-hidden"
                      style={{
                        left: pctLeft(shift.startTime),
                        width: pctWidth(shift.startTime, shift.endTime),
                        backgroundColor: isFilled
                          ? (employeeColorMap.get(assignedNames[0]) ?? shift.color ?? '#6366f1') + 'dd'
                          : 'transparent',
                        border: isFilled ? 'none' : '1.5px dashed #d1d5db',
                        backgroundImage: isFilled ? 'none' : 'repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#fafafa 4px,#fafafa 8px)',
                      }}
                    >
                      {isFilled ? (
                        <span className="text-white truncate drop-shadow-sm text-[11px]">{assignedNames.join(' · ')}</span>
                      ) : (
                        <span className="text-gray-400 truncate text-[11px]">
                          {shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)} · Open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          {employeeColorMap.size > 0 && (
            <div className="flex flex-wrap gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50/50">
              {Array.from(employeeColorMap.entries()).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {name}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <div className="h-2.5 w-2.5 rounded border border-dashed border-gray-300" />
                Unfilled
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
