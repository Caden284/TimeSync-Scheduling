'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { mockOrg, mockEmployees, mockLaborBreakdown, mockWeeklyTrend } from '@/lib/mock-data';
import { formatCurrency, formatHours } from '@/lib/utils';
import { Download, FileText, BarChart3, Users, Clock, Shield, TrendingUp, ChevronRight } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';

const REPORT_TYPES = [
  {
    id: 'labor-cost',
    icon: <BarChart3 size={18} className="text-indigo-600" />,
    title: 'Labor Cost Report',
    description: 'Total labor cost breakdown by department, role, and location with budget variance.',
    format: 'CSV / PDF',
    lastGenerated: '2026-06-04',
  },
  {
    id: 'scheduled-hours',
    icon: <Clock size={18} className="text-blue-600" />,
    title: 'Scheduled Hours Report',
    description: 'Hours scheduled per employee, including regular, overtime, and break time.',
    format: 'CSV / PDF',
    lastGenerated: '2026-06-04',
  },
  {
    id: 'payroll-export',
    icon: <FileText size={18} className="text-green-600" />,
    title: 'Payroll Export',
    description: 'ADP / Paychex / QuickBooks compatible payroll file with hours and pay rates.',
    format: 'CSV / XML',
    lastGenerated: '2026-06-01',
  },
  {
    id: 'certification',
    icon: <Shield size={18} className="text-red-600" />,
    title: 'Certification Compliance',
    description: 'All employee certifications, expiry dates, and renewal status.',
    format: 'CSV / PDF',
    lastGenerated: '2026-06-03',
  },
  {
    id: 'attendance',
    icon: <Users size={18} className="text-purple-600" />,
    title: 'Attendance & Absence',
    description: 'Attendance rates, no-shows, late arrivals, and time-off usage by employee.',
    format: 'CSV / PDF',
    lastGenerated: '2026-06-04',
  },
  {
    id: 'overtime',
    icon: <TrendingUp size={18} className="text-amber-600" />,
    title: 'Overtime Analysis',
    description: 'Overtime hours and cost per employee with trend comparison to prior periods.',
    format: 'CSV / PDF',
    lastGenerated: '2026-06-04',
  },
];

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const content = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { setOrg, copilotOpen } = useAppStore();
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => { setOrg(mockOrg); }, []);

  function handleGenerate(reportId: string) {
    setGenerating(reportId);
    setTimeout(() => {
      setGenerating(null);

      if (reportId === 'labor-cost') {
        downloadCSV('labor-cost-report.csv',
          mockLaborBreakdown.map(d => [
            d.departmentName,
            String(d.regularHours),
            String(d.overtimeHours),
            String(d.regularCost),
            String(d.overtimeCost),
            String(d.totalCost),
            String(d.budget),
            String(d.budgetVariance),
          ]),
          ['Department', 'Regular Hours', 'OT Hours', 'Regular Cost', 'OT Cost', 'Total Cost', 'Budget', 'Variance']
        );
      } else if (reportId === 'scheduled-hours') {
        downloadCSV('scheduled-hours-report.csv',
          mockEmployees.map(e => [
            `${e.firstName} ${e.lastName}`,
            e.primaryDept?.name ?? '',
            String(e.weeklyHoursTarget ?? 0),
            String(e.payRate ?? 0),
            e.employmentType,
            e.status,
          ]),
          ['Employee', 'Department', 'Weekly Hours Target', 'Pay Rate', 'Employment Type', 'Status']
        );
      } else if (reportId === 'payroll-export') {
        downloadCSV('payroll-export.csv',
          mockEmployees.map(e => [
            e.employeeNumber ?? e.id.slice(0, 8),
            `${e.firstName} ${e.lastName}`,
            String(e.weeklyHoursTarget ?? 0),
            '0',
            String(e.payRate ?? 0),
            String(((e.weeklyHoursTarget ?? 0) * (e.payRate ?? 0)).toFixed(2)),
          ]),
          ['Employee ID', 'Name', 'Regular Hours', 'Overtime Hours', 'Pay Rate', 'Gross Pay']
        );
      } else if (reportId === 'certification') {
        downloadCSV('certification-compliance.csv',
          mockEmployees.flatMap(e =>
            e.certifications.length > 0
              ? e.certifications.map(c => [
                  `${e.firstName} ${e.lastName}`,
                  c.certDef?.name ?? '',
                  c.issuedDate ?? '',
                  c.expiryDate ?? '',
                  c.status,
                ])
              : [[`${e.firstName} ${e.lastName}`, 'No certifications', '', '', '']]
          ),
          ['Employee', 'Certification', 'Issued', 'Expires', 'Status']
        );
      } else {
        downloadCSV(`${reportId}-report.csv`,
          mockEmployees.map(e => [`${e.firstName} ${e.lastName}`, e.status, e.employmentType]),
          ['Employee', 'Status', 'Type']
        );
      }
    }, 1200);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Reports"
          subtitle="Generate and download workforce reports"
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

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
                        <p className="text-[10px] text-gray-400">Last: {report.lastGenerated} · {report.format}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">{report.description}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs"
                      loading={generating === report.id}
                      onClick={() => handleGenerate(report.id)}
                      leftIcon={<Download size={12} />}
                    >
                      {generating === report.id ? 'Generating…' : 'Download CSV'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick data preview — Labor Cost */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Labor Cost — Quick Preview</h2>
                <Button variant="secondary" size="sm" className="text-xs" leftIcon={<Download size={12} />}
                  onClick={() => handleGenerate('labor-cost')} loading={generating === 'labor-cost'}>
                  Download Full Report
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Department', 'Reg Hours', 'OT Hours', 'Regular Cost', 'OT Cost', 'Total', 'Budget', 'Variance'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {mockLaborBreakdown.map(row => (
                      <tr key={row.departmentId} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{row.departmentName}</td>
                        <td className="py-2.5 px-3 text-gray-600">{row.regularHours}h</td>
                        <td className="py-2.5 px-3 text-red-600 font-medium">{row.overtimeHours}h</td>
                        <td className="py-2.5 px-3 text-gray-700">{formatCurrency(row.regularCost)}</td>
                        <td className="py-2.5 px-3 text-red-600">{formatCurrency(row.overtimeCost)}</td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{formatCurrency(row.totalCost)}</td>
                        <td className="py-2.5 px-3 text-gray-600">{formatCurrency(row.budget)}</td>
                        <td className="py-2.5 px-3 text-green-600 font-medium">+{formatCurrency(row.budgetVariance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-gray-900">Total</td>
                      <td className="py-2.5 px-3 font-medium">{mockLaborBreakdown.reduce((s, r) => s + r.regularHours, 0)}h</td>
                      <td className="py-2.5 px-3 font-medium text-red-600">{mockLaborBreakdown.reduce((s, r) => s + r.overtimeHours, 0)}h</td>
                      <td className="py-2.5 px-3 font-medium">{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.regularCost, 0))}</td>
                      <td className="py-2.5 px-3 font-medium text-red-600">{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.overtimeCost, 0))}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.totalCost, 0))}</td>
                      <td className="py-2.5 px-3 font-bold">{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.budget, 0))}</td>
                      <td className="py-2.5 px-3 font-bold text-green-600">+{formatCurrency(mockLaborBreakdown.reduce((s, r) => s + r.budgetVariance, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}
