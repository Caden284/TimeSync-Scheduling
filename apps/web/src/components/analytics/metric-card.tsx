'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatCurrency, formatHours } from '@/lib/utils';
import type { AnalyticsMetric } from '@/types';

interface MetricCardProps {
  metric: AnalyticsMetric;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ metric, icon, className }: MetricCardProps) {
  const formatted = metric.unit === 'currency'
    ? formatCurrency(metric.value)
    : metric.unit === 'hours'
    ? formatHours(metric.value)
    : metric.unit === 'percentage'
    ? `${metric.value.toFixed(1)}%`
    : metric.value.toLocaleString();

  const trendColor = metric.trend === 'up'
    ? metric.label.toLowerCase().includes('cost') || metric.label.toLowerCase().includes('overtime')
      ? 'text-red-600' : 'text-green-600'
    : metric.trend === 'down'
    ? metric.label.toLowerCase().includes('cost') || metric.label.toLowerCase().includes('overtime')
      ? 'text-green-600' : 'text-red-600'
    : 'text-gray-500';

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">{metric.label}</p>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            {icon}
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-gray-900">{formatted}</p>

      {metric.trendPct !== undefined && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trendColor)}>
          <TrendIcon size={13} />
          <span>{Math.abs(metric.trendPct).toFixed(1)}% vs last week</span>
        </div>
      )}
    </div>
  );
}
