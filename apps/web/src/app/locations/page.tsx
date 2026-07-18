'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { mockOrg, mockLocations, mockDepartments, mockEmployees } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Plus, MapPin, Users, Building2, X, Globe, Edit2 } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AddLocationModal } from '@/components/locations/add-location-modal';
import { useAuth } from '@/context/auth-context';
import { getLocations } from '@/lib/db';

export default function LocationsPage() {
  const { setOrg, copilotOpen } = useAppStore();
  const { profile } = useAuth();
  const [locations, setLocations] = useState<any[]>(mockLocations);
  const [selected, setSelected] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setOrg(mockOrg);
    if (profile?.orgId) {
      getLocations(profile.orgId).then(docs => {
        if (docs.length > 0) setLocations(docs.map(d => ({ ...d, id: d.$id })));
      }).catch(() => {});
    }
  }, [profile?.orgId]);

  function getDeptCount(locationId: string) {
    return mockDepartments.filter(d => d.locationId === locationId).length;
  }
  function getEmployeeCount(locationId: string) {
    return mockEmployees.filter(e => e.primaryLocationId === locationId).length;
  }

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Locations"
          subtitle={`${locations.length} location${locations.length !== 1 ? 's' : ''}`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
              onClick={() => setShowAddModal(true)}>
              Add Location
            </Button>
          }
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Locations', value: locations.length,        icon: <MapPin size={16} className="text-indigo-500" /> },
                { label: 'Total Departments', value: mockDepartments.length, icon: <Building2 size={16} className="text-purple-500" /> },
                { label: 'Total Employees', value: mockEmployees.length,    icon: <Users size={16} className="text-blue-500" /> },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center">{stat.icon}</div>
                  <div>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Location cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {locations.map(loc => {
                const deptCount = getDeptCount(loc.id);
                const empCount = getEmployeeCount(loc.id);
                const depts = mockDepartments.filter(d => d.locationId === loc.id);
                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelected(selected?.id === loc.id ? null : loc)}
                    className={cn(
                      'bg-white rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md',
                      selected?.id === loc.id ? 'border-indigo-400 ring-1 ring-indigo-400 shadow-md' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <MapPin size={16} className="text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{loc.name}</h3>
                          {loc.code && <p className="text-[10px] text-gray-500 font-mono">{loc.code}</p>}
                        </div>
                      </div>
                      <Badge variant={loc.isActive ? 'success' : 'default'}>
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                      <Globe size={11} />
                      {[loc.city, loc.state].filter(Boolean).join(', ') || 'No address'}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-4">
                      <span className="flex items-center gap-1"><Building2 size={11} className="text-gray-400" />{deptCount} dept{deptCount !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><Users size={11} className="text-gray-400" />{empCount} employee{empCount !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Departments */}
                    {depts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {depts.map(d => (
                          <span
                            key={d.id}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: d.color ?? '#6366f1' }}
                          >
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end mt-3">
                      <button className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <Edit2 size={11} /> Edit
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add new card */}
              <button className="rounded-xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors min-h-[160px]">
                <Plus size={20} />
                <span className="text-xs font-medium">Add Location</span>
              </button>
            </div>

            {/* Departments table */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">All Departments</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Department', 'Location', 'Weekly Budget', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mockDepartments.map(dept => {
                    const loc = mockLocations.find(l => l.id === dept.locationId);
                    return (
                      <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dept.color ?? '#6366f1' }} />
                            <span className="font-medium text-gray-900">{dept.name}</span>
                            {dept.code && <span className="text-[10px] text-gray-400 font-mono">{dept.code}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{loc?.name ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-700">
                          {dept.budgetWeekly ? `$${dept.budgetWeekly.toLocaleString()}/wk` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={dept.isActive ? 'success' : 'default'}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showAddModal && (
        <AddLocationModal onClose={() => setShowAddModal(false)}
          onSaved={loc => setLocations(prev => [...prev, loc])} />
      )}
    </div>
    </AuthGuard>
  );
}
