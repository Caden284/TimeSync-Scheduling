'use client';

import { cn, formatTime } from '@/lib/utils';
import { useCalendarStore } from '@/store';
import type { Shift } from '@/types';
import { format, parseISO, isToday } from 'date-fns';
import { Plus } from 'lucide-react';

interface DayViewProps {
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onCreateShift?: (date: string) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function DayView({ shifts, onShiftClick, onCreateShift }: DayViewProps) {
  const { currentDate } = useCalendarStore();
  const date = parseISO(currentDate + 'T00:00:00');
  const dateStr = format(date, 'yyyy-MM-dd');
  const today = isToday(date);

  const dayShifts = shifts.filter(s => s.date === dateStr);

  // Sort shifts by start time
  const sorted = [...dayShifts].sort((a, b) =>
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  // Group shifts into columns to handle overlaps
  type Col = Shift[];
  const columns: Col[] = [];
  for (const shift of sorted) {
    const start = timeToMinutes(shift.startTime);
    const col = columns.find(c => {
      const last = c[c.length - 1];
      return timeToMinutes(last.endTime) <= start;
    });
    if (col) col.push(shift);
    else columns.push([shift]);
  }

  const DAY_START = 6 * 60;   // 6:00am in minutes
  const DAY_SPAN  = 18 * 60;  // 18 hours shown
  const ROW_H = 64;           // px per hour

  function pct(minutes: number) {
    return ((minutes - DAY_START) / DAY_SPAN) * 100;
  }
  function heightPct(start: number, end: number) {
    return ((end - start) / DAY_SPAN) * 100;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Day header */}
      <div className={cn('border-b border-gray-200 px-6 py-3 flex items-center gap-3', today && 'bg-indigo-50/40')}>
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-xl font-bold', today ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700')}>
          {format(date, 'd')}
        </div>
        <div>
          <p className={cn('text-base font-bold', today ? 'text-indigo-700' : 'text-gray-900')}>{format(date, 'EEEE')}</p>
          <p className="text-xs text-gray-400">{format(date, 'MMMM yyyy')} · {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => onCreateShift?.(dateStr)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-indigo-700 transition-colors"
        >
          <Plus size={13} /> Add Shift
        </button>
      </div>

      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Hour labels */}
        <div className="w-16 flex-shrink-0 border-r border-gray-100 select-none">
          {HOURS.map(h => (
            <div key={h} style={{ height: ROW_H }} className="flex items-start justify-end pr-3 pt-1">
              <span className="text-[10px] font-medium text-gray-400">
                {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </span>
            </div>
          ))}
        </div>

        {/* Grid + shifts */}
        <div className="flex-1 relative" style={{ height: HOURS.length * ROW_H }}>
          {/* Hour lines */}
          {HOURS.map((h, i) => (
            <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: i * ROW_H }} />
          ))}

          {/* Current time line */}
          {today && (() => {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            if (nowMin >= DAY_START && nowMin <= DAY_START + DAY_SPAN) {
              const topPct = pct(nowMin);
              return (
                <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: `${topPct}%` }}>
                  <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 h-px bg-red-500" />
                </div>
              );
            }
          })()}

          {/* Click-to-add zones */}
          {HOURS.map((h, i) => (
            <div key={h}
              onClick={() => {
                const hStr = String(h).padStart(2, '0');
                onCreateShift?.(dateStr);
              }}
              className="absolute left-1 right-1 hover:bg-indigo-50/40 cursor-pointer transition-colors rounded"
              style={{ top: i * ROW_H + 1, height: ROW_H - 2 }}
            />
          ))}

          {/* Shift blocks */}
          {columns.map((col, colIdx) =>
            col.map(shift => {
              const startMin = timeToMinutes(shift.startTime);
              const endMin   = timeToMinutes(shift.endTime);
              const top    = pct(startMin);
              const height = heightPct(startMin, endMin);
              const color  = shift.color ?? '#6366f1';
              const colCount = columns.length;
              const width = `calc((100% - 8px) / ${colCount})`;
              const left  = `calc(${colIdx} * (100% - 8px) / ${colCount} + 4px)`;

              return (
                <div
                  key={shift.id}
                  onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                  className="absolute rounded-lg border cursor-pointer hover:shadow-md transition-all overflow-hidden group"
                  style={{
                    top: `${top}%`, height: `${Math.max(height, 2.5)}%`,
                    width, left,
                    backgroundColor: `${color}18`,
                    borderColor: `${color}50`,
                    borderLeftColor: color,
                    borderLeftWidth: 3,
                  }}
                >
                  <div className="px-2 py-1 h-full flex flex-col justify-start">
                    <p className="text-xs font-bold leading-tight truncate" style={{ color }}>
                      {shift.title ?? 'Shift'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {shift.startTime.slice(0,5)} – {shift.endTime.slice(0,5)}
                    </p>
                    {shift.department?.name && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{shift.department.name}</p>
                    )}
                    {shift.isOpen && (
                      <span className="mt-auto text-[9px] font-bold text-amber-600 uppercase tracking-wide">Open</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Empty state */}
          {dayShifts.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm text-gray-400">No shifts on {format(date, 'MMMM d')}</p>
                <p className="text-xs text-gray-300 mt-1">Click &quot;Add Shift&quot; to create one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
