'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AddEmployeeModal } from '@/components/employees/add-employee-modal';
import { EditEmployeeModal } from '@/components/employees/edit-employee-modal';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { mockOrg } from '@/lib/mock-data';
import { getEmployees } from '@/lib/db';
import { employmentTypeBadge, getEmployeeDisplayName, cn } from '@/lib/utils';
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone, Edit2, X } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success', on_leave: 'warning', terminated: 'danger', inactive: 'default',
};

const EMPLOYMENT_TYPES = ['all', 'full_time', 'part_time', 'contract', 'per_diem'];

export default function EmployeesPage() {
  const { setOrg, copilotOpen } = useAppStore();
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    setOrg(mockOrg);
    if (profile?.orgId) {
      getEmployees(profile.orgId)
        .then(docs => setEmployees(docs.map(d => ({ ...d, id: d.$id }))))
        .catch(() => {})
        .finally(() => setLoadingEmployees(false));
    } else {
      setLoadingEmployees(false);
    }
  }, [profile?.orgId]);

  const filtered = employees.filter(emp => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (emp.firstName ?? '').toLowerCase().includes(q) ||
      (emp.lastName  ?? '').toLowerCase().includes(q) ||
      (emp.email     ?? '').toLowerCase().includes(q) ||
      (emp.role      ?? '').toLowerCase().includes(q);
    const matchType = filterType === 'all' || emp.employmentType === filterType;
    return matchSearch && matchType;
  });

  const activeCount = employees.filter(e => e.isActive !== false && e.status !== 'terminated').length;

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Employees"
          subtitle={`${activeCount} active employee${activeCount !== 1 ? 's' : ''}`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
              onClick={() => setShowAddModal(true)}>
              Add Employee
            </Button>
          }
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Search & filters */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search employees…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Filter size={13} />} className="text-xs"
                  onClick={() => setShowFilterPanel(p => !p)}>
                  Filter {filterType !== 'all' && `· ${filterType.replace('_', '-')}`}
                </Button>
                <div className="ml-auto text-sm text-gray-500">{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Filter panel */}
              {showFilterPanel && (
                <div className="mb-4 p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 mr-1">Employment type:</span>
                  {EMPLOYMENT_TYPES.map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      className={cn('px-2.5 py-1 rounded-md text-xs capitalize transition-all',
                        filterType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                      {t === 'all' ? 'All' : t.replace('_', '-')}
                    </button>
                  ))}
                  {filterType !== 'all' && (
                    <button onClick={() => setFilterType('all')} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <X size={11} /> Clear
                    </button>
                  )}
                </div>
              )}

              {/* Employee table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Employee', 'Role / Department', 'Type', 'Pay Rate', ''].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingEmployees && (
                      <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
                    )}
                    {!loadingEmployees && employees.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center">
                        <p className="text-sm font-medium text-gray-700 mb-1">No employees yet</p>
                        <p className="text-xs text-gray-400">Click &ldquo;Add Employee&rdquo; to add your first team member.</p>
                      </td></tr>
                    )}
                    {!loadingEmployees && employees.length > 0 && filtered.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                        No employees match your search.
                      </td></tr>
                    )}
                    {filtered.map(emp => {
                      const typeBadge = employmentTypeBadge(emp.employmentType ?? 'full_time');
                      const isSelected = selectedEmp?.id === emp.id || selectedEmp?.$id === emp.$id;
                      return (
                        <tr key={emp.id ?? emp.$id}
                          onClick={() => setSelectedEmp(isSelected ? null : emp)}
                          className={cn('cursor-pointer transition-colors', isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50/60')}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar firstName={emp.firstName} lastName={emp.lastName}
                                color={emp.displayColor ?? emp.avatarColor ?? '#6366f1'} size="sm" />
                              <div>
                                <p className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-gray-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <p className="text-sm">{emp.role ?? emp.primaryRole?.name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{emp.departmentName ?? emp.primaryDept?.name ?? ''}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', typeBadge.className)}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {emp.payRate ? `$${parseFloat(emp.payRate).toFixed(2)}/hr` : '—'}
                          </td>
                          <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setSelectedEmp(emp); setShowEditModal(true); }}
                              className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Edit2 size={14} />
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

          {/* Detail panel */}
          {selectedEmp && !showEditModal && !copilotOpen && (
            <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto shrink-0">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="flex items-start justify-between mb-3">
                  <Avatar firstName={selectedEmp.firstName} lastName={selectedEmp.lastName}
                    color={selectedEmp.displayColor ?? '#6366f1'} size="lg" />
                  <button onClick={() => setSelectedEmp(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <h2 className="text-base font-bold text-gray-900">{selectedEmp.firstName} {selectedEmp.lastName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedEmp.role ?? selectedEmp.primaryRole?.name ?? 'Staff'}</p>
                <p className="text-xs text-gray-400">{selectedEmp.departmentName ?? selectedEmp.primaryDept?.name ?? ''}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  {selectedEmp.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Mail size={13} className="text-gray-400" />{selectedEmp.email}
                    </div>
                  )}
                  {selectedEmp.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Phone size={13} className="text-gray-400" />{selectedEmp.phone}
                    </div>
                  )}
                </div>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-gray-500">Employment</span>
                    <span className="font-medium capitalize">{(selectedEmp.employmentType ?? 'full_time').replace('_', '-')}</span></div>
                  {selectedEmp.payRate && <div className="flex justify-between"><span className="text-gray-500">Pay Rate</span>
                    <span className="font-medium">${parseFloat(selectedEmp.payRate).toFixed(2)}/hr</span></div>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setShowEditModal(true)}>Edit Profile</Button>
                </div>
              </div>
            </aside>
          )}

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showAddModal && (
        <AddEmployeeModal onClose={() => setShowAddModal(false)}
          onSaved={emp => setEmployees(prev => [...prev, emp])} />
      )}
      {showEditModal && selectedEmp && (
        <EditEmployeeModal employee={selectedEmp} onClose={() => setShowEditModal(false)}
          onSaved={updated => setEmployees(prev => prev.map(e => (e.id ?? e.$id) === (updated.id ?? updated.$id) ? updated : e))}
          onDeleted={id => { setEmployees(prev => prev.filter(e => (e.id ?? e.$id) !== id)); setSelectedEmp(null); }} />
      )}
    </div>
    </AuthGuard>
  );
}
