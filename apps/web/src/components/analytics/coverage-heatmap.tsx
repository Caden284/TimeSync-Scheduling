'use client';

import { coverageColor } from '@/lib/utils';
import type { CoverageHeatmapCell } from '@/types';
import { format, parseISO } from 'date-fns';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p'];

interface CoverageHeatmapProps {
  data: CoverageHeatmapCell[];
  dates: string[];
}

export function CoverageHeatmap({ data, dates }: CoverageHeatmapProps) {
  function getCell(date: string, hour: number): CoverageHeatmapCell | undefined {
    return data.find((c) => c.date === date && c.hour === hour);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Coverage Heatmap</h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
            Under-staffed
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#eab308' }} />
            Partial
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
            Full coverage
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-0.5" style={{ minWidth: 600 }}>
          {/* Hour labels */}
          <div className="flex flex-col gap-0.5">
            <div className="h-8 w-8" /> {/* header spacer */}
            {HOURS.filter((_, i) => i % 3 === 0).map((h) => (
              <div key={h} style={{ height: 18 * 3 + 4 }} className="flex items-center">
                <span className="text-[9px] text-gray-400 w-8 text-right pr-1">{HOUR_LABELS[h]}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dates.map((date) => (
            <div key={date} className="flex flex-col gap-0.5 flex-1 min-w-[60px]">
              {/* Day header */}
              <div className="h-8 flex items-center justify-center">
                <span className="text-[10px] font-medium text-gray-600">
                  {format(parseISO(date + 'T00:00:00'), 'EEE d')}
                </span>
              </div>
              {/* Hour cells */}
              {HOURS.map((hour) => {
                const cell = getCell(date, hour);
                const pct = cell ? cell.coveragePct : 0;
                const color = cell ? coverageColor(pct) : '#f3f4f6';
                return (
                  <div
                    key={hour}
                    title={cell ? `${format(parseISO(date + 'T00:00:00'), 'MMM d')} ${HOUR_LABELS[hour]}: ${cell.scheduled}/${cell.required} (${pct.toFixed(0)}%)` : ''}
                    className="h-[18px] rounded-sm transition-opacity hover:opacity-80 cursor-default"
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
