'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { mockOrg, mockEmployees } from '@/lib/mock-data';
import { employmentTypeBadge, getEmployeeDisplayName, cn } from '@/lib/utils';
import { Search, Plus, Filter, MoreHorizontal, ChevronDown, Mail, Phone, Calendar } from 'lucide-react';
import type { Employee } from '@/types';
import { CopilotPanel } from '@/components/copilot/copilot-panel';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success', on_leave: 'warning', terminated: 'danger', inactive: 'default',
};

export default function EmployeesPage() {
  const { setOrg, copilotOpen } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  useEffect(() => { setOrg(mockOrg); }, []);

  const filtered = mockEmployees.filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(q) ||
      emp.lastName.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.tags.some((t) => t.includes(q))
    );
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Employees"
          subtitle={`${mockEmployees.filter((e) => e.status === 'active').length} active employees`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs">
              Add Employee
            </Button>
          }
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Search & filters */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Filter size={13} />} className="text-xs">
                  Filter
                </Button>
                <div className="ml-auto text-sm text-gray-500">
                  {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Employee table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Employee', 'Department', 'Employment Type', 'Status', 'Weekly Hours', 'Pay Rate', ''].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((emp) => {
                      const typeBadge = employmentTypeBadge(emp.employmentType);
                      const isSelected = selectedEmp?.id === emp.id;
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedEmp(isSelected ? null : emp)}
                          className={cn(
                            'cursor-pointer transition-colors',
                            isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50/60'
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                firstName={emp.firstName}
                                lastName={emp.lastName}
                                color={emp.displayColor}
                                size="sm"
                              />
                              <div>
                                <p className="font-semibold text-gray-900">{getEmployeeDisplayName(emp)}</p>
                                <p className="text-xs text-gray-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {emp.primaryDept?.name ?? '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', typeBadge.className)}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={STATUS_BADGE[emp.status] ?? 'default'}>
                              {emp.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {emp.weeklyHoursTarget ?? '—'}h/wk
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {emp.payRate ? `$${emp.payRate.toFixed(2)}/hr` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                              <MoreHorizontal size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Employee detail panel */}
          {selectedEmp && !copilotOpen && (
            <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="flex items-start justify-between mb-3">
                  <Avatar
                    firstName={selectedEmp.firstName}
                    lastName={selectedEmp.lastName}
                    color={selectedEmp.displayColor}
                    size="lg"
                  />
                  <button onClick={() => setSelectedEmp(null)} className="p-1 text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <h2 className="text-base font-bold text-gray-900">{getEmployeeDisplayName(selectedEmp)}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedEmp.primaryRole?.name ?? selectedEmp.primaryDept?.name}</p>
                <div className="flex gap-2 mt-3">
                  <Badge variant={STATUS_BADGE[selectedEmp.status] ?? 'default'}>{selectedEmp.status}</Badge>
                  <Badge variant="default">{employmentTypeBadge(selectedEmp.employmentType).label}</Badge>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <Section title="Contact">
                  <InfoItem icon={<Mail size={13} />} value={selectedEmp.email} />
                  {selectedEmp.phone && <InfoItem icon={<Phone size={13} />} value={selectedEmp.phone} />}
                </Section>

                <Section title="Employment">
                  <InfoRow label="Hire Date" value={selectedEmp.hireDate ?? '—'} />
                  <InfoRow label="Weekly Target" value={`${selectedEmp.weeklyHoursTarget ?? '—'}h`} />
                  <InfoRow label="Pay Rate" value={selectedEmp.payRate ? `$${selectedEmp.payRate.toFixed(2)}/hr` : '—'} />
                  <InfoRow label="Overtime" value={selectedEmp.overtimeEligible ? 'Eligible' : 'Exempt'} />
                  <InfoRow label="Union Member" value={selectedEmp.unionMember ? 'Yes' : 'No'} />
                </Section>

                {selectedEmp.tags.length > 0 && (
                  <Section title="Tags">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEmp.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Availability">
                  <div className="grid grid-cols-7 gap-1">
                    {['S','M','T','W','T','F','S'].map((d, i) => {
                      const av = selectedEmp.availability.find((a) => a.dayOfWeek === i);
                      return (
                        <div
                          key={i}
                          title={av?.preference ?? 'unknown'}
                          className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                            av?.preference === 'preferred' ? 'bg-green-100 text-green-700' :
                            av?.preference === 'available' ? 'bg-blue-100 text-blue-600' :
                            'bg-gray-100 text-gray-400'
                          )}
                        >
                          {d}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-200" />Preferred</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-200" />Available</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-200" />Off</span>
                  </div>
                </Section>

                <div className="flex gap-2 pt-2">
                  <Button variant="primary" size="sm" className="flex-1">Edit Profile</Button>
                  <Button variant="secondary" size="sm">Schedule</Button>
                </div>
              </div>
            </aside>
          )}

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoItem({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      <span className="text-gray-400">{icon}</span>
      {value}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
