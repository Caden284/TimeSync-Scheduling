'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { getShifts, getEmployees, getTimeOffRequests, getDepartments } from '@/lib/db';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Users, AlertTriangle, Activity, Clock, Calendar, CheckCircle2, BarChart3 } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { format, subWeeks, startOfWeek, endOfWeek, parseISO, addDays } from 'date-fns';

const DEPT_COLORS = ['#6366f1', '#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#14b8a6'];

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, diff > 0 ? diff / 60 : (diff + 1440) / 60);
}

function fmtCurrency(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { copilotOpen } = useAppStore();
  const { profile } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.orgId) return;
    const rangeStart = format(subWeeks(new Date(), 5), 'yyyy-MM-dd');
    const rangeEnd   = format(addDays(endOfWeek(new Date(), { weekStartsOn: 0 }), 1), 'yyyy-MM-dd');
    setLoading(true);
    Promise.all([
      getEmployees(profile.orgId),
      getShifts(profile.orgId, rangeStart, rangeEnd),
      getTimeOffRequests(profile.orgId),
      getDepartments(profile.orgId),
    ])
      .then(([emps, sh, tor, depts]) => {
        setEmployees(emps);
        setShifts(sh);
        setTimeOff(tor);
        setDepartments(depts);
      })
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const totalShifts   = shifts.length;
  const openShifts    = shifts.filter(s => s.isOpen).length;
  const filledShifts  = totalShifts - openShifts;
  const coverageRate  = totalShifts > 0 ? ((filledShifts / totalShifts) * 100).toFixed(1) : '—';

  const avgPayRate = employees.length > 0
    ? employees.reduce((s, e) => s + (parseFloat(e.payRate ?? '0') || 0), 0) / employees.length
    : 0;

  const totalScheduledHours = shifts
    .filter(s => !s.isOpen)
    .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime) * (s.minStaff ?? 1), 0);

  const estimatedLaborCost = totalScheduledHours * avgPayRate;

  const avgHoursPerEmployee = employees.length > 0
    ? (totalScheduledHours / employees.length).toFixed(1)
    : '0';

  const pendingTimeOff = timeOff.filter(r => r.status === 'pending').length;

  // ── Weekly trend (last 5 weeks) ──────────────────────────────────────────────
  const weeklyTrend = Array.from({ length: 5 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(new Date(), 4 - i), { weekStartsOn: 0 });
    const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 0 });
    const ws = format(weekStart, 'yyyy-MM-dd');
    const we = format(weekEnd,   'yyyy-MM-dd');
    const weekShifts = shifts.filter(s => s.date >= ws && s.date <= we);
    const hours = weekShifts.filter(s => !s.isOpen)
      .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime) * (s.minStaff ?? 1), 0);
    const cost = hours * avgPayRate;
    return {
      week: format(weekStart, 'MMM d'),
      shifts: weekShifts.length,
      hours: Math.round(hours),
      cost: Math.round(cost),
      open: weekShifts.filter(s => s.isOpen).length,
    };
  });

  // ── Department breakdown ─────────────────────────────────────────────────────
  const deptMap: Record<string, { name: string; shifts: number; hours: number; cost: number }> = {};
  for (const s of shifts.filter(s => !s.isOpen)) {
    const key = s.departmentName ?? 'Unassigned';
    if (!deptMap[key]) deptMap[key] = { name: key, shifts: 0, hours: 0, cost: 0 };
    const h = shiftHours(s.startTime, s.endTime) * (s.minStaff ?? 1);
    deptMap[key].shifts += 1;
    deptMap[key].hours  += h;
    deptMap[key].cost   += h * avgPayRate;
  }
  const deptBreakdown = Object.values(deptMap).sort((a, b) => b.hours - a.hours);

  // ── Employment type breakdown ────────────────────────────────────────────────
  const typeMap: Record<string, number> = {};
  for (const e of employees) {
    const t = (e.employmentType ?? 'unknown').replace('_', '-');
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }
  const typeBreakdown = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // ── Time-off summary ─────────────────────────────────────────────────────────
  const torByStatus = {
    pending:  timeOff.filter(r => r.status === 'pending').length,
    approved: timeOff.filter(r => r.status === 'approved').length,
    denied:   timeOff.filter(r => r.status === 'denied').length,
  };

  const isEmpty = !loading && employees.length === 0 && shifts.length === 0;

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title="Workforce Analytics" subtitle="Live data from your Appwrite records" />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Loading analytics…</p>
                </div>
              </div>
            ) : isEmpty ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
                  <h2 className="text-base font-semibold text-gray-700 mb-2">No data yet</h2>
                  <p className="text-sm text-gray-400">Add employees and shifts to start seeing analytics. Everything here updates automatically.</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <StatCard label="Total Employees" value={String(employees.length)} sub={`${employees.filter(e => e.employmentType === 'full_time').length} full-time`} icon={<Users size={15} className="text-indigo-600" />} color="bg-indigo-50" />
                  <StatCard label="Scheduled Hours" value={`${Math.round(totalScheduledHours)}h`} sub="filled shifts" icon={<Clock size={15} className="text-blue-600" />} color="bg-blue-50" />
                  <StatCard label="Est. Labor Cost" value={avgPayRate > 0 ? fmtCurrency(estimatedLaborCost) : '—'} sub={avgPayRate > 0 ? `avg $${avgPayRate.toFixed(0)}/hr` : 'add pay rates'} icon={<Activity size={15} className="text-green-600" />} color="bg-green-50" />
                  <StatCard label="Coverage Rate" value={totalShifts > 0 ? `${coverageRate}%` : '—'} sub={`${filledShifts}/${totalShifts} shifts filled`} icon={<CheckCircle2 size={15} className="text-emerald-600" />} color="bg-emerald-50" />
                  <StatCard label="Open Shifts" value={String(openShifts)} sub={openShifts > 0 ? 'need coverage' : 'fully covered'} icon={<AlertTriangle size={15} className={openShifts > 0 ? 'text-amber-600' : 'text-gray-400'} />} color={openShifts > 0 ? 'bg-amber-50' : 'bg-gray-50'} />
                  <StatCard label="Time-Off Pending" value={String(pendingTimeOff)} sub={`${torByStatus.approved} approved`} icon={<Calendar size={15} className="text-purple-600" />} color="bg-purple-50" />
                </div>

                {/* Weekly trend */}
                {weeklyTrend.some(w => w.shifts > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Shifts & Hours — Last 5 Weeks</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={weeklyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                          <YAxis yAxisId="shifts" orientation="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                          <YAxis yAxisId="hours"  orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                          <Tooltip contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line yAxisId="shifts" type="monotone" dataKey="shifts" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Total Shifts" />
                          <Line yAxisId="hours"  type="monotone" dataKey="hours"  stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="Hours Scheduled" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Employment type donut */}
                    {typeBreakdown.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Staff by Type</h3>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                              {typeBreakdown.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1.5 mt-2">
                          {typeBreakdown.map((t, i) => (
                            <div key={t.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                                <span className="text-gray-600 capitalize">{t.name}</span>
                              </div>
                              <span className="font-medium text-gray-900">{t.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Department hours bar chart */}
                {deptBreakdown.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Hours by Department</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={deptBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="h" />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]} name="Hours">
                          {deptBreakdown.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Department detail table */}
                {deptBreakdown.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Department Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Department', 'Filled Shifts', 'Scheduled Hours', 'Est. Cost'].map(h => (
                              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {deptBreakdown.map((row, i) => (
                            <tr key={row.name} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                                  <span className="font-medium text-gray-900">{row.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-gray-700">{row.shifts}</td>
                              <td className="py-2.5 px-3 text-gray-700">{row.hours.toFixed(1)}h</td>
                              <td className="py-2.5 px-3 text-gray-700">{avgPayRate > 0 ? fmtCurrency(row.cost) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200">
                          <tr>
                            <td className="py-2.5 px-3 font-bold text-gray-900">Total</td>
                            <td className="py-2.5 px-3 font-medium">{deptBreakdown.reduce((s, r) => s + r.shifts, 0)}</td>
                            <td className="py-2.5 px-3 font-medium">{deptBreakdown.reduce((s, r) => s + r.hours, 0).toFixed(1)}h</td>
                            <td className="py-2.5 px-3 font-bold">{avgPayRate > 0 ? fmtCurrency(deptBreakdown.reduce((s, r) => s + r.cost, 0)) : '—'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Time-off summary */}
                {timeOff.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Time-Off Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Pending',  value: torByStatus.pending,  color: 'text-amber-600', bg: 'bg-amber-50'  },
                        { label: 'Approved', value: torByStatus.approved, color: 'text-green-600', bg: 'bg-green-50'  },
                        { label: 'Denied',   value: torByStatus.denied,   color: 'text-red-600',   bg: 'bg-red-50'    },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
                          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
