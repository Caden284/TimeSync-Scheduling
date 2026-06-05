'use client';

import { cn, formatTime } from '@/lib/utils';
import { useCalendarStore } from '@/store';
import type { Shift } from '@/types';
import { ShiftCard } from './shift-card';
import { format, parseISO, isToday, addDays, startOfWeek } from 'date-fns';
import { Plus } from 'lucide-react';

interface WeekViewProps {
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onCreateShift?: (date: string, employeeId?: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekDates(currentDate: string) {
  const d = parseISO(currentDate + 'T00:00:00');
  const start = startOfWeek(d, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function WeekView({ shifts, onShiftClick, onCreateShift }: WeekViewProps) {
  const { currentDate, selectedShiftIds, selectShift, filters } = useCalendarStore();
  const weekDates = getWeekDates(currentDate);

  function getShiftsForDate(date: Date): Shift[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter((s) => {
      if (s.date !== dateStr) return false;
      if (filters.departmentIds?.length && !filters.departmentIds.includes(s.departmentId ?? '')) return false;
      return true;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day header row */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-white sticky top-0 z-10">
        {weekDates.map((date, i) => {
          const today = isToday(date);
          return (
            <div
              key={i}
              className={cn(
                'py-3 px-2 text-center border-r border-gray-100 last:border-r-0',
                today && 'bg-indigo-50/60'
              )}
            >
              <p className={cn('text-xs font-medium uppercase tracking-wide',
                today ? 'text-indigo-600' : 'text-gray-500'
              )}>
                {DAYS[i]}
              </p>
              <p className={cn(
                'text-xl font-bold mt-0.5',
                today ? 'text-indigo-600' : 'text-gray-900'
              )}>
                {format(date, 'd')}
              </p>
              {today && (
                <div className="mx-auto h-1 w-1 rounded-full bg-indigo-600 mt-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Shift grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 min-h-full divide-x divide-gray-100">
          {weekDates.map((date, dayIdx) => {
            const dayShifts = getShiftsForDate(date);
            const today = isToday(date);
            const dateStr = format(date, 'yyyy-MM-dd');

            // Group shifts by time block
            const dayShiftGroups = {
              morning: dayShifts.filter((s) => s.startTime < '12:00:00'),
              afternoon: dayShifts.filter((s) => s.startTime >= '12:00:00' && s.startTime < '18:00:00'),
              evening: dayShifts.filter((s) => s.startTime >= '18:00:00'),
            };

            return (
              <div
                key={dayIdx}
                className={cn(
                  'min-h-full p-2 flex flex-col gap-1.5',
                  today ? 'bg-indigo-50/30' : 'bg-white hover:bg-gray-50/50',
                )}
              >
                {/* Morning block */}
                {dayShiftGroups.morning.length > 0 && (
                  <ShiftTimeBlock
                    label="Morning"
                    shifts={dayShiftGroups.morning}
                    selectedIds={selectedShiftIds}
                    onShiftClick={(s) => { selectShift(s.id); onShiftClick(s); }}
                  />
                )}

                {/* Afternoon block */}
                {dayShiftGroups.afternoon.length > 0 && (
                  <ShiftTimeBlock
                    label="Afternoon"
                    shifts={dayShiftGroups.afternoon}
                    selectedIds={selectedShiftIds}
                    onShiftClick={(s) => { selectShift(s.id); onShiftClick(s); }}
                  />
                )}

                {/* Evening block */}
                {dayShiftGroups.evening.length > 0 && (
                  <ShiftTimeBlock
                    label="Evening"
                    shifts={dayShiftGroups.evening}
                    selectedIds={selectedShiftIds}
                    onShiftClick={(s) => { selectShift(s.id); onShiftClick(s); }}
                  />
                )}

                {/* Empty state / add button */}
                {dayShifts.length === 0 && (
                  <button
                    onClick={() => onCreateShift?.(dateStr)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors min-h-[80px]"
                  >
                    <Plus size={16} />
                    <span className="text-[10px]">Add shift</span>
                  </button>
                )}

                {/* Add more button */}
                {dayShifts.length > 0 && (
                  <button
                    onClick={() => onCreateShift?.(dateStr)}
                    className="flex items-center justify-center gap-1 rounded-md border border-dashed border-gray-200 py-1 text-[10px] text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors"
                  >
                    <Plus size={10} />
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShiftTimeBlock({
  label, shifts, selectedIds, onShiftClick,
}: {
  label: string;
  shifts: Shift[];
  selectedIds: string[];
  onShiftClick: (s: Shift) => void;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-gray-400 font-medium px-0.5 mb-1">{label}</p>
      <div className="flex flex-col gap-1">
        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            compact
            selected={selectedIds.includes(shift.id)}
            onClick={onShiftClick}
          />
        ))}
      </div>
    </div>
  );
}
