'use client';

import { ChevronLeft, ChevronRight, Calendar, Layers, Zap, Download, Eye, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarStore, useAppStore } from '@/store';
import { cn, formatDateRange } from '@/lib/utils';
import type { CalendarView } from '@/types';
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day',        label: 'Day' },
  { id: 'week',       label: 'Week' },
  { id: 'month',      label: 'Month' },
  { id: 'timeline',   label: 'Timeline' },
  { id: 'department', label: 'Dept' },
];

interface CalendarToolbarProps {
  onGenerate?: () => void;
  isGenerating?: boolean;
  scheduleStatus?: string;
  onPublish?: () => void;
}

export function CalendarToolbar({ onGenerate, isGenerating, scheduleStatus, onPublish }: CalendarToolbarProps) {
  const { view, setView, currentDate, navigate, showCoverageOverlay, toggleCoverageOverlay } = useCalendarStore();
  const { toggleCopilot } = useAppStore();

  const parsedDate = parseISO(currentDate + 'T00:00:00');
  const weekStart = startOfWeek(parsedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 0 });

  const rangeLabel = view === 'day'
    ? format(parsedDate, 'MMMM d, yyyy')
    : view === 'week' || view === 'department' || view === 'timeline'
    ? formatDateRange(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'))
    : format(parsedDate, 'MMMM yyyy');

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="icon-sm" onClick={() => navigate('prev')}>
          <ChevronLeft size={14} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('today')} className="text-xs">
          Today
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => navigate('next')}>
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Date range label */}
      <h2 className="text-sm font-semibold text-gray-900 min-w-[180px]">{rangeLabel}</h2>

      <div className="flex-1" />

      {/* Coverage overlay */}
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleCoverageOverlay}
        className={cn('text-xs gap-1', showCoverageOverlay && 'bg-indigo-50 border-indigo-300 text-indigo-700')}
        leftIcon={<Eye size={13} />}
      >
        Coverage
      </Button>

      {/* Filter */}
      <Button variant="secondary" size="sm" className="text-xs" leftIcon={<Filter size={13} />}>
        Filter
      </Button>

      {/* View switcher */}
      <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
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

      {/* Generate */}
      <Button
        variant="ai"
        size="sm"
        onClick={onGenerate}
        loading={isGenerating}
        leftIcon={<Zap size={13} />}
        className="text-xs"
      >
        {isGenerating ? 'Generating…' : 'AI Generate'}
      </Button>

      {/* Publish */}
      {scheduleStatus === 'draft' || scheduleStatus === 'review' ? (
        <Button variant="success" size="sm" onClick={onPublish} className="text-xs">
          Publish
        </Button>
      ) : scheduleStatus === 'published' ? (
        <span className="text-xs font-medium text-green-600 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Published
        </span>
      ) : null}
    </div>
  );
}
