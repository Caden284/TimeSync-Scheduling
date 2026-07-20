'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { getEmployees, getShifts, getTimeOffRequests, getDepartments } from '@/lib/db';
import { Download, FileText, BarChart3, Users, Clock, Shield, TrendingUp, AlertCircle } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { format, subWeeks, startOfWeek, endOfWeek, addDays } from 'date-fns';

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, diff > 0 ? diff / 60 : (diff + 1440) / 60);
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const content = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.orgId) return;
    const rangeStart = format(subWeeks(new Date(), 8), 'yyyy-MM-dd');
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
      .catch(() => addToast({ type: 'error', title: 'Failed to load report data' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  const avgPayRate = employees.length > 0
    ? employees.reduce((s, e) => s + (parseFloat(e.payRate ?? '0') || 0), 0) / employees.length
    : 0;

  async function handleGenerate(reportId: string) {
    if (employees.length === 0 && shifts.length === 0) {
      addToast({ type: 'warning', title: 'No data yet', message: 'Add employees and shifts first.' });
      return;
    }
    setGenerating(reportId);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      if (reportId === 'scheduled-hours') {
        // Per-employee scheduled hours
        const empHours: Record<string, { name: string; dept: string; type: string; payRate: string; hours: number }> = {};
        for (const e of employees) {
          empHours[e.$id] = {
            name: `${e.firstName} ${e.lastName}`,
            dept: e.departmentName ?? '',
            type: (e.employmentType ?? '').replace('_', '-'),
            payRate: e.payRate ? `$${parseFloat(e.payRate).toFixed(2)}` : '—',
            hours: 0,
          };
        }
        // Shifts don't store individual assignments yet — show by dept
        const rows = Object.values(empHours).map(e => [e.name, e.dept, e.type, e.payRate, String(e.hours)]);
        downloadCSV(`scheduled-hours-${today}.csv`,
          ['Employee', 'Department', 'Employment Type', 'Pay Rate', 'Scheduled Hours'],
          rows.length > 0 ? rows : [['No employees', '', '', '', '']]);

      } else if (reportId === 'labor-cost') {
        // Department-level cost breakdown
        const deptMap: Record<string, { name: string; shifts: number; hours: number; cost: number }> = {};
        for (const s of shifts.filter(s => !s.isOpen)) {
          const key = s.departmentName ?? 'Unassigned';
          if (!deptMap[key]) deptMap[key] = { name: key, shifts: 0, hours: 0, cost: 0 };
          const h = shiftHours(s.startTime, s.endTime) * (s.minStaff ?? 1);
          deptMap[key].shifts += 1;
          deptMap[key].hours  += h;
          deptMap[key].cost   += h * avgPayRate;
        }
        const rows = Object.values(deptMap).map(d => [
          d.name, String(d.shifts), d.hours.toFixed(1),
          avgPayRate > 0 ? `$${d.cost.toFixed(2)}` : '—',
        ]);
        downloadCSV(`labor-cost-${today}.csv`,
          ['Department', 'Filled Shifts', 'Scheduled Hours', 'Est. Labor Cost'],
          rows.length > 0 ? rows : [['No shift data', '', '', '']]);

      } else if (reportId === 'payroll-export') {
        const rows = employees.map(e => [
          e.$id.slice(0, 8).toUpperCase(),
          `${e.firstName} ${e.lastName}`,
          e.email ?? '',
          (e.employmentType ?? '').replace('_', '-'),
          e.payRate ? `$${parseFloat(e.payRate).toFixed(2)}/hr` : '—',
          e.departmentName ?? '',
        ]);
        downloadCSV(`payroll-export-${today}.csv`,
          ['Employee ID', 'Name', 'Email', 'Employment Type', 'Pay Rate', 'Department'],
          rows.length > 0 ? rows : [['No employees', '', '', '', '', '']]);

      } else if (reportId === 'time-off') {
        const rows = timeOff.map((r: any) => [
          r.employeeName ?? '',
          r.leaveType ?? '',
          r.startDate ?? '',
          r.endDate ?? '',
          r.reason ?? '',
          r.status ?? '',
          r.$createdAt?.split('T')[0] ?? '',
        ]);
        downloadCSV(`time-off-${today}.csv`,
          ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Submitted'],
          rows.length > 0 ? rows : [['No requests', '', '', '', '', '', '']]);

      } else if (reportId === 'headcount') {
        const rows = employees.map(e => [
          `${e.firstName} ${e.lastName}`,
          e.email ?? '',
          (e.employmentType ?? '').replace('_', '-'),
          e.departmentName ?? '',
          e.payRate ? `$${parseFloat(e.payRate).toFixed(2)}/hr` : '—',
          e.$createdAt?.split('T')[0] ?? '',
        ]);
        downloadCSV(`headcount-${today}.csv`,
          ['Name', 'Email', 'Type', 'Department', 'Pay Rate', 'Added'],
          rows.length > 0 ? rows : [['No employees', '', '', '', '', '']]);

      } else if (reportId === 'shift-coverage') {
        const rows = shifts.map(s => [
          s.date ?? '',
          s.startTime ?? '',
          s.endTime ?? '',
          s.title ?? '',
          s.departmentName ?? '',
          s.locationName ?? '',
          s.isOpen ? 'Open' : 'Filled',
          s.status ?? '',
          String(s.minStaff ?? 1),
          s.notes ?? '',
        ]);
        downloadCSV(`shift-coverage-${today}.csv`,
          ['Date', 'Start', 'End', 'Title', 'Department', 'Location', 'Status', 'Schedule Status', 'Min Staff', 'Notes'],
          rows.length > 0 ? rows : [['No shifts', '', '', '', '', '', '', '', '', '']]);
      }

      addToast({ type: 'success', title: 'Report downloaded' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Report failed', message: e?.message });
    } finally {
      setGenerating(null);
    }
  }

  const hasData = employees.length > 0 || shifts.length > 0;

  const REPORT_TYPES = [
    {
      id: 'scheduled-hours',
      icon: <Clock size={18} className="text-blue-600" />,
      title: 'Scheduled Hours',
      description: 'All employees with employment type and pay rate. Hours will populate once shift assignments are tracked.',
      format: 'CSV',
      count: `${employees.length} employees`,
    },
    {
      id: 'labor-cost',
      icon: <BarChart3 size={18} className="text-indigo-600" />,
      title: 'Labor Cost by Department',
      description: 'Scheduled hours and estimated labor cost grouped by department, based on average pay rate.',
      format: 'CSV',
      count: `${shifts.filter(s => !s.isOpen).length} filled shifts`,
    },
    {
      id: 'payroll-export',
      icon: <FileText size={18} className="text-green-600" />,
      title: 'Payroll Export',
      description: 'Employee roster with IDs, pay rates, and employment types — ready to import into payroll software.',
      format: 'CSV',
      count: `${employees.length} employees`,
    },
    {
      id: 'time-off',
      icon: <Shield size={18} className="text-purple-600" />,
      title: 'Time-Off Requests',
      description: 'All time-off requests with status, dates, and leave type.',
      format: 'CSV',
      count: `${timeOff.length} requests`,
    },
    {
      id: 'headcount',
      icon: <Users size={18} className="text-amber-600" />,
      title: 'Headcount Report',
      description: 'Full employee roster with contact info, department, and date added.',
      format: 'CSV',
      count: `${employees.length} employees`,
    },
    {
      id: 'shift-coverage',
      icon: <TrendingUp size={18} className="text-red-600" />,
      title: 'Shift Coverage',
      description: 'Every shift in the period with open/filled status, department, location, and staffing requirements.',
      format: 'CSV',
      count: `${shifts.length} shifts`,
    },
  ];

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar title="Reports" subtitle="Download live reports from your real data" />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {!loading && !hasData && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">No data to report yet</p>
                  <p className="text-xs text-amber-700 mt-0.5">Add employees and shifts first. Reports update automatically as you enter data.</p>
                </div>
              </div>
            )}

            {/* Data summary row */}
            {!loading && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Employees',     value: employees.length },
                  { label: 'Total Shifts',  value: shifts.length },
                  { label: 'Filled Shifts', value: shifts.filter(s => !s.isOpen).length },
                  { label: 'Time-Off Reqs', value: timeOff.length },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Report cards */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Available Reports</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {REPORT_TYPES.map(report => (
                  <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center">
                        {report.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">{report.title}</h3>
                        <p className="text-[10px] text-gray-400">{loading ? 'Loading…' : report.count} · {report.format}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">{report.description}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs"
                      loading={generating === report.id}
                      disabled={loading}
                      onClick={() => handleGenerate(report.id)}
                      leftIcon={<Download size={12} />}
                    >
                      {generating === report.id ? 'Generating…' : 'Download CSV'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Employee quick view */}
            {employees.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Employee Roster Preview</h2>
                  <Button variant="secondary" size="sm" className="text-xs" leftIcon={<Download size={12} />}
                    onClick={() => handleGenerate('headcount')} loading={generating === 'headcount'}>
                    Download Full Roster
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Name', 'Email', 'Type', 'Department', 'Pay Rate'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {employees.slice(0, 10).map(e => (
                        <tr key={e.$id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-medium text-gray-900">{e.firstName} {e.lastName}</td>
                          <td className="py-2.5 px-3 text-gray-600">{e.email || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-600 capitalize">{(e.employmentType ?? '').replace('_', '-')}</td>
                          <td className="py-2.5 px-3 text-gray-600">{e.departmentName || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-700">{e.payRate ? `$${parseFloat(e.payRate).toFixed(2)}/hr` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {employees.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-3">
                      Showing 10 of {employees.length} employees — download for the full list
                    </p>
                  )}
                </div>
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
