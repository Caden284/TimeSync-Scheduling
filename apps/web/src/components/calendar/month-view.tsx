'use client';

import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/store';
import type { Shift } from '@/types';
import {
  format, parseISO, isToday, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
} from 'date-fns';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthViewProps {
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onCreateShift?: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthView({ shifts, onShiftClick, onCreateShift }: MonthViewProps) {
  const { currentDate, setCurrentDate, setView } = useCalendarStore();
  const pivot = parseISO(currentDate + 'T00:00:00');

  // Build full 6-row grid
  const monthStart = startOfMonth(pivot);
  const monthEnd   = endOfMonth(pivot);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 0 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Index shifts by date string
  const byDate: Record<string, Shift[]> = {};
  for (const s of shifts) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  function prevMonth() {
    const d = new Date(pivot);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(format(d, 'yyyy-MM-dd'));
  }
  function nextMonth() {
    const d = new Date(pivot);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(format(d, 'yyyy-MM-dd'));
  }
  function goToday() {
    setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Month header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <h2 className="text-sm font-bold text-gray-900 w-36 text-center">{format(pivot, 'MMMM yyyy')}</h2>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={16} className="text-gray-600" />
        </button>
        <button onClick={goToday} className="ml-2 text-xs text-indigo-600 font-medium hover:underline">Today</button>
        <div className="ml-auto text-xs text-gray-400">
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''} this period
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day, i) => {
          const dateStr  = format(day, 'yyyy-MM-dd');
          const dayShifts = byDate[dateStr] ?? [];
          const inMonth  = isSameMonth(day, pivot);
          const today    = isToday(day);
          const MAX_SHOW = 3;

          return (
            <div key={dateStr}
              className={cn(
                'border-b border-r border-gray-100 flex flex-col min-h-0 overflow-hidden group',
                !inMonth && 'bg-gray-50/60',
              )}
            >
              {/* Date number */}
              <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                <button
                  onClick={() => {
                    setCurrentDate(dateStr);
                    setView('day');
                  }}
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                    today
                      ? 'bg-indigo-600 text-white'
                      : inMonth
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-300',
                  )}
                >
                  {format(day, 'd')}
                </button>
                {inMonth && (
                  <button
                    onClick={() => onCreateShift?.(dateStr)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>

              {/* Shift chips */}
              <div className="flex flex-col gap-0.5 px-1 pb-1 overflow-hidden flex-1">
                {dayShifts.slice(0, MAX_SHOW).map(shift => {
                  const color = shift.color ?? '#6366f1';
                  return (
                    <button
                      key={shift.id}
                      onClick={() => onShiftClick(shift)}
                      className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate hover:opacity-80 transition-opacity leading-tight"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {shift.startTime.slice(0, 5)} {shift.title ?? 'Shift'}
                    </button>
                  );
                })}
                {dayShifts.length > MAX_SHOW && (
                  <button
                    onClick={() => {
                      setCurrentDate(dateStr);
                      setView('day');
                    }}
                    className="text-[10px] text-gray-400 hover:text-indigo-600 text-left px-1.5 leading-tight"
                  >
                    +{dayShifts.length - MAX_SHOW} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
