'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Clock, Calendar } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { NewRequestModal } from '@/components/time-off/new-request-modal';
import { useAuth } from '@/context/auth-context';
import { getTimeOffRequests, updateTimeOffStatus } from '@/lib/db';

interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
}

const STATUS_MAP = {
  pending:  { label: 'Pending',  variant: 'warning'  as const },
  approved: { label: 'Approved', variant: 'success'  as const },
  denied:   { label: 'Denied',   variant: 'danger'   as const },
};

const LEAVE_COLORS: Record<string, string> = {
  'Vacation':    'bg-blue-100 text-blue-700',
  'Sick Leave':  'bg-red-100 text-red-700',
  'Personal':    'bg-purple-100 text-purple-700',
  'Bereavement': 'bg-gray-100 text-gray-700',
};

export default function TimeOffPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    getTimeOffRequests(profile.orgId)
      .then(docs => {
        setRequests(docs.map((d: any) => ({
          id: d.$id,
          employeeId: d.employeeId,
          employeeName: d.employeeName,
          leaveType: d.leaveType,
          startDate: d.startDate,
          endDate: d.endDate,
          reason: d.reason ?? '',
          status: d.status,
          submittedAt: d.$createdAt?.split('T')[0] ?? '',
        })));
      })
      .catch(() => addToast({ type: 'error', title: 'Failed to load time-off requests' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  async function approve(id: string) {
    setActioning(id);
    try {
      await updateTimeOffStatus(id, 'approved');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
      addToast({ type: 'success', title: 'Request approved' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to approve request', message: e?.message });
    } finally {
      setActioning(null);
    }
  }

  async function deny(id: string) {
    setActioning(id);
    try {
      await updateTimeOffStatus(id, 'denied');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' as const } : r));
      addToast({ type: 'success', title: 'Request denied' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to deny request', message: e?.message });
    } finally {
      setActioning(null);
    }
  }

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Time Off"
          subtitle={`${pendingCount} request${pendingCount !== 1 ? 's' : ''} pending approval`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
              onClick={() => setShowNewModal(true)}>
              New Request
            </Button>
          }
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Pending',  value: requests.filter(r => r.status === 'pending').length,  color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200' },
                { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
                { label: 'Denied',   value: requests.filter(r => r.status === 'denied').length,   color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200' },
                { label: 'Total',    value: requests.length,                                       color: 'text-gray-700',  bg: 'bg-white',     border: 'border-gray-200' },
              ].map(card => (
                <div key={card.label} className={cn('rounded-xl border p-4', card.bg, card.border)}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
                  <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
              {(['all', 'pending', 'approved', 'denied'] as const).map(tab => (
                <button key={tab} onClick={() => setFilter(tab)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all',
                    filter === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Employee', 'Leave Type', 'Dates', 'Reason', 'Submitted', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading && (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">Loading…</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center">
                      <Clock size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {requests.length === 0 ? 'No time-off requests yet' : `No ${filter} requests`}
                      </p>
                      {requests.length === 0 && (
                        <p className="text-xs text-gray-400">Click &ldquo;New Request&rdquo; to submit one.</p>
                      )}
                    </td></tr>
                  )}
                  {!loading && filtered.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar firstName={req.employeeName.split(' ')[0]} lastName={req.employeeName.split(' ')[1] ?? ''} color="#6366f1" size="sm" />
                          <span className="font-medium text-gray-900">{req.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', LEAVE_COLORS[req.leaveType] ?? 'bg-gray-100 text-gray-600')}>
                          {req.leaveType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-gray-400" />
                          {req.startDate === req.endDate ? req.startDate : `${req.startDate} → ${req.endDate}`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-[160px] truncate">{req.reason || '—'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{req.submittedAt}</td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_MAP[req.status].variant}>{STATUS_MAP[req.status].label}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => approve(req.id)} disabled={actioning === req.id}
                              className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors border border-green-200">
                              <Check size={11} /> Approve
                            </button>
                            <button onClick={() => deny(req.id)} disabled={actioning === req.id}
                              className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200">
                              <X size={11} /> Deny
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showNewModal && (
        <NewRequestModal
          onClose={() => setShowNewModal(false)}
          onSaved={req => {
            setRequests(prev => [req, ...prev]);
            addToast({ type: 'success', title: 'Time-off request submitted' });
          }}
        />
      )}
    </div>
    </AuthGuard>
  );
}
