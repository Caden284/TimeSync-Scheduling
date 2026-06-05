'use client';

import { cn, formatShiftTime, getContrastColor } from '@/lib/utils';
import type { Shift } from '@/types';
import { AvatarGroup } from '@/components/ui/avatar';
import { Users, AlertCircle, Lock } from 'lucide-react';

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: (shift: Shift) => void;
  onDragStart?: (shift: Shift, e: React.DragEvent) => void;
}

export function ShiftCard({ shift, compact, selected, highlighted, onClick, onDragStart }: ShiftCardProps) {
  const color = shift.color ?? '#6366f1';
  const textColor = getContrastColor(color);
  const assignedCount = shift.assignments.length;
  const coverage = shift.minStaff > 0 ? assignedCount / shift.minStaff : 1;
  const isUnderstaffed = coverage < 1;
  const isOpen = shift.isOpen || shift.status === 'open';

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onClick?.(shift)}
      onDragStart={(e) => onDragStart?.(shift, e)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(shift)}
      className={cn(
        'group relative rounded-md cursor-grab active:cursor-grabbing select-none transition-all',
        'border overflow-hidden',
        selected
          ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md'
          : 'hover:shadow-md hover:scale-[1.01]',
        highlighted && 'ring-2 ring-yellow-400',
        compact ? 'px-2 py-1' : 'px-2.5 py-2',
        isOpen && 'border-dashed',
      )}
      style={{
        backgroundColor: `${color}20`,
        borderColor: `${color}60`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 inset-y-0 w-1 rounded-l-md"
        style={{ backgroundColor: color }}
      />

      <div className="pl-1.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-1">
          <p
            className={cn('text-xs font-semibold leading-tight truncate', compact ? 'text-[10px]' : '')}
            style={{ color }}
          >
            {shift.title ?? shift.role?.name ?? 'Shift'}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            {isUnderstaffed && <AlertCircle size={10} className="text-red-500" />}
            {isOpen && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Open</span>}
          </div>
        </div>

        {/* Time */}
        {!compact && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            {formatShiftTime(shift.startTime, shift.endTime)}
          </p>
        )}

        {/* Assignees */}
        {!compact && shift.assignments.length > 0 && (
          <div className="flex items-center justify-between mt-1.5">
            <AvatarGroup
              employees={shift.assignments
                .filter((a) => a.employee)
                .map((a) => ({
                  id: a.employeeId,
                  firstName: a.employee!.firstName,
                  lastName: a.employee!.lastName,
                  displayColor: a.employee!.displayColor,
                  avatarUrl: a.employee!.avatarUrl,
                }))}
              max={3}
              size="xs"
            />
            <span className="text-[9px] text-gray-400 font-medium">
              {assignedCount}/{shift.minStaff}
            </span>
          </div>
        )}

        {compact && shift.assignments.length > 0 && (
          <p className="text-[9px] text-gray-500 mt-0.5">
            {shift.assignments[0]?.employee
              ? `${shift.assignments[0].employee.firstName} ${shift.assignments[0].employee.lastName[0]}.`
              : ''}
            {shift.assignments.length > 1 && ` +${shift.assignments.length - 1}`}
          </p>
        )}
      </div>
    </div>
  );
}
