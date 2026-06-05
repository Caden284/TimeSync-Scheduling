'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MetricCard } from '@/components/analytics/metric-card';
import { CoverageHeatmap } from '@/components/analytics/coverage-heatmap';
import { useAppStore } from '@/store';
import {
  mockAnalyticsMetrics, mockLaborBreakdown, mockWeeklyTrend,
  mockCoverageHeatmap, mockOrg,
} from '@/lib/mock-data';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, Clock, Users, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { CopilotPanel } from '@/components/copilot/copilot-panel';

const ICONS = [
  <DollarSign size={16} />, <Clock size={16} />, <Users size={16} />,
  <AlertTriangle size={16} />, <Activity size={16} />, <TrendingUp size={16} />,
];

const DEPT_COLORS = ['#6366f1', '#f97316', '#8b5cf6', '#06b6d4', '#22c55e'];

function getWeekDates() {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

export default function AnalyticsPage() {
  const { setOrg, copilotOpen } = useAppStore();
  useEffect(() => { setOrg(mockOrg); }, []);

  const weekDates = getWeekDates();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Workforce Analytics"
          subtitle="Real-time labor intelligence — Metro General Hospital"
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {mockAnalyticsMetrics.map((metric, i) => (
                  <MetricCard key={metric.label} metric={metric} icon={ICONS[i]} />
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Weekly Cost Trend */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Labor Cost & Overtime Trend</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={mockWeeklyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis yAxisId="cost" orientation="left" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis yAxisId="hours" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === 'cost' ? formatCurrency(value) : `${value}h`
                        }
                        labelStyle={{ fontSize: 12, fontWeight: 600 }}
                        contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="cost" type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Labor Cost" />
                      <Line yAxisId="hours" type="monotone" dataKey="overtime" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="Overtime (h)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Cost by Dept Pie */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Department</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={mockLaborBreakdown}
                        dataKey="totalCost"
                        nameKey="departmentName"
                        cx="50%" cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {mockLaborBreakdown.map((entry, i) => (
                          <Cell key={entry.departmentId} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {mockLaborBreakdown.map((d, i) => (
                      <div key={d.departmentId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                          <span className="text-gray-600">{d.departmentName}</span>
                        </div>
                        <span className="font-medium text-gray-900">{formatCurrency(d.totalCost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget vs Actual */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Budget vs Actual — By Department</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mockLaborBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="departmentName" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="budget" fill="#e0e7ff" name="Budget" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalCost" fill="#6366f1" name="Actual" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overtimeCost" fill="#ef4444" name="Overtime" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Coverage Heatmap */}
              <CoverageHeatmap data={mockCoverageHeatmap} dates={weekDates} />

              {/* Department Table */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Department Detail</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Department', 'Reg Hours', 'OT Hours', 'Reg Cost', 'OT Cost', 'Total', 'Budget', 'Variance'].map((h) => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {mockLaborBreakdown.map((row, i) => (
                        <tr key={row.departmentId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPT_COLORS[i] }} />
                              <span className="font-medium text-gray-900">{row.departmentName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">{row.regularHours}h</td>
                          <td className="py-2.5 px-3">
                            <span className={row.overtimeHours > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                              {row.overtimeHours}h
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">{formatCurrency(row.regularCost)}</td>
                          <td className="py-2.5 px-3 text-red-600">{formatCurrency(row.overtimeCost)}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{formatCurrency(row.totalCost)}</td>
                          <td className="py-2.5 px-3 text-gray-700">{formatCurrency(row.budget)}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-green-600 font-medium">+{formatCurrency(row.budgetVariance)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200">
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-gray-900">Total</td>
                        <td className="py-2.5 px-3 font-medium">
                          {mockLaborBreakdown.reduce((s, r) => s + r.regularHours, 0)}h
                        </td>
                        <td className="py-2.5 px-3 font-medium text-red-600">
                          {mockLaborBreakdown.reduce((s, r) => s + r.overtimeHours, 0)}h
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.regularCost, 0))}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-red-600">
                          {formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.overtimeCost, 0))}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.totalCost, 0))}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.budget, 0))}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-green-600">
                          +{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.budgetVariance, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}
