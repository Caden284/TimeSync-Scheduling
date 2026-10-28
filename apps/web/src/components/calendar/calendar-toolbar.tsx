'use client';

import { ChevronLeft, ChevronRight, Zap, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/store';
import { cn, formatDateRange } from '@/lib/utils';
import type { CalendarView } from '@/types';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day',            label: 'Day' },
  { id: 'week',           label: 'Week' },
  { id: 'month',          label: 'Month' },
  { id: 'timeline',       label: 'Timeline' },
  { id: 'staff_timeline', label: 'Staff' },
];

interface CalendarToolbarProps {
  onFillPreset?: () => void;
  isFillingPreset?: boolean;
  onGenerate?: () => void;
  isGenerating?: boolean;
  scheduleStatus?: 'draft' | 'published';
  onPublish?: () => void;
  onUnpublish?: () => void;
  isPublishing?: boolean;
}

export function CalendarToolbar({ onFillPreset, isFillingPreset, onGenerate, isGenerating, scheduleStatus, onPublish, onUnpublish, isPublishing }: CalendarToolbarProps) {
  const { view, setView, currentDate, navigate } = useCalendarStore();

  const parsedDate = parseISO(currentDate + 'T00:00:00');
  const weekStart = startOfWeek(parsedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 0 });

  const rangeLabel = (view === 'day' || view === 'staff_timeline')
    ? format(parsedDate, 'MMMM d, yyyy')
    : (view === 'week' || view === 'department' || view === 'timeline')
    ? formatDateRange(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'))
    : format(parsedDate, 'MMMM yyyy');

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-gray-200 bg-white">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="icon-sm" onClick={() => navigate('prev')} aria-label="Previous">
          <ChevronLeft size={14} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('today')} className="text-xs">
          Today
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => navigate('next')} aria-label="Next">
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Date range label */}
      <h2 className="text-sm font-semibold text-gray-900 sm:min-w-[180px]">{rangeLabel}</h2>

      <div className="hidden sm:block flex-1" />

      {/* View switcher */}
      <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5 overflow-x-auto max-w-full">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              view === v.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Creates the week's slots from the season's pre-set schedule */}
      {onFillPreset && (
        <Button variant="secondary" size="sm" onClick={onFillPreset} loading={isFillingPreset}
          leftIcon={<LayoutTemplate size={13} />} className="text-xs" title="Create this week's slots from the season's pre-set schedule">
          Fill from pre-set
        </Button>
      )}

      {/* Auto-schedule: fills open shifts for the week using the rule engine */}
      <Button
        variant="ai"
        size="sm"
        onClick={onGenerate}
        loading={isGenerating}
        leftIcon={<Zap size={13} />}
        className="text-xs"
      >
        {isGenerating ? 'Scheduling…' : 'Auto-Schedule'}
      </Button>

      {/* Publish applies to the week shown */}
      {scheduleStatus === 'published' ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-green-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Published
          </span>
          <button onClick={onUnpublish} disabled={isPublishing}
            className="text-xs text-gray-400 hover:text-gray-700 underline-offset-2 hover:underline disabled:opacity-50">
            Unpublish
          </button>
        </div>
      ) : scheduleStatus === 'draft' ? (
        <Button variant="success" size="sm" onClick={onPublish} loading={isPublishing} className="text-xs">
          Publish week
        </Button>
      ) : null}
    </div>
  );
}
