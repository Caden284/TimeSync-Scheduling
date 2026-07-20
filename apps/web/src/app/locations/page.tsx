'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { Plus, MapPin, Building2, Globe, Trash2 } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AddLocationModal } from '@/components/locations/add-location-modal';
import { useAuth } from '@/context/auth-context';
import { getLocations, deleteLocation, getDepartments } from '@/lib/db';

export default function LocationsPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    Promise.all([getLocations(profile.orgId), getDepartments(profile.orgId)])
      .then(([locs, depts]) => {
        setLocations(locs.map(d => ({ ...d, id: d.$id })));
        setDepartments(depts.map(d => ({ ...d, id: d.$id })));
      })
      .catch(() => addToast({ type: 'error', title: 'Failed to load locations' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  async function handleDelete(locId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this location? This cannot be undone.')) return;
    setDeleting(locId);
    try {
      await deleteLocation(locId);
      setLocations(prev => prev.filter(l => l.id !== locId));
      if (selected?.id === locId) setSelected(null);
      addToast({ type: 'success', title: 'Location deleted' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to delete location', message: err?.message });
    } finally {
      setDeleting(null);
    }
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Locations',   value: locations.length,   icon: <MapPin    size={16} className="text-indigo-500" /> },
                { label: 'Total Departments', value: departments.length,  icon: <Building2 size={16} className="text-purple-500" /> },
                { label: 'Avg Depts / Location', value: locations.length > 0 ? (departments.length / locations.length).toFixed(1) : '0', icon: <Building2 size={16} className="text-blue-500" /> },
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

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
            ) : locations.length === 0 ? (
              <div className="py-16 text-center">
                <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">No locations yet</p>
                <p className="text-xs text-gray-400 mb-4">Add your first location to get started.</p>
                <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowAddModal(true)}>
                  Add Location
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {locations.map(loc => {
                  const depts = departments.filter(d => d.locationId === loc.id);
                  return (
                    <div key={loc.id}
                      onClick={() => setSelected(selected?.id === loc.id ? null : loc)}
                      className={cn(
                        'bg-white rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md',
                        selected?.id === loc.id ? 'border-indigo-400 ring-1 ring-indigo-400 shadow-md' : 'border-gray-200'
                      )}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <MapPin size={16} className="text-indigo-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900">{loc.name}</h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                        <Globe size={11} />
                        {[loc.city, loc.state].filter(Boolean).join(', ') || 'No address set'}
                      </div>

                      <div className="text-xs text-gray-500 mb-4">
                        <Building2 size={11} className="inline mr-1 text-gray-400" />
                        {depts.length} department{depts.length !== 1 ? 's' : ''}
                      </div>

                      {depts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {depts.map(d => (
                            <span key={d.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: d.color ?? '#6366f1' }}>
                              {d.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end mt-2">
                        <button onClick={(e) => handleDelete(loc.id, e)} disabled={deleting === loc.id}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors">
                          <Trash2 size={11} /> {deleting === loc.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button onClick={() => setShowAddModal(true)}
                  className="rounded-xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors min-h-[160px]">
                  <Plus size={20} />
                  <span className="text-xs font-medium">Add Location</span>
                </button>
              </div>
            )}

            {departments.length > 0 && (
              <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">All Departments</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {['Department', 'Location'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {departments.map(dept => {
                      const loc = locations.find(l => l.id === dept.locationId);
                      return (
                        <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dept.color ?? '#6366f1' }} />
                              <span className="font-medium text-gray-900">{dept.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{loc?.name ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showAddModal && (
        <AddLocationModal
          onClose={() => setShowAddModal(false)}
          onSaved={loc => {
            setLocations(prev => [...prev, { ...loc, id: loc.$id ?? loc.id }]);
            addToast({ type: 'success', title: 'Location added' });
          }}
        />
      )}
    </div>
    </AuthGuard>
  );
}
