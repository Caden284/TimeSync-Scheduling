'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAppStore } from '@/store';
import { mockOrg, mockEmployees } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Clock, Calendar, ChevronRight } from 'lucide-react';
import { CopilotPanel } from '@/components/copilot/copilot-panel';

interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  avatarColor: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
}

const MOCK_REQUESTS: TimeOffRequest[] = [
  { id: 'tor-1', employeeId: 'emp-1', employeeName: 'Sarah Chen',     avatarColor: '#ef4444', leaveType: 'Vacation',    startDate: '2026-06-14', endDate: '2026-06-18', hours: 36, reason: 'Family vacation',          status: 'pending',  submittedAt: '2026-06-03' },
  { id: 'tor-2', employeeId: 'emp-2', employeeName: 'Marcus Williams', avatarColor: '#f97316', leaveType: 'Sick Leave',  startDate: '2026-06-09', endDate: '2026-06-09', hours: 12, reason: 'Doctor appointment',       status: 'pending',  submittedAt: '2026-06-05' },
  { id: 'tor-3', employeeId: 'emp-4', employeeName: 'Jordan Smith',    avatarColor: '#06b6d4', leaveType: 'Personal',   startDate: '2026-06-20', endDate: '2026-06-20', hours: 8,  reason: 'Personal errand',          status: 'approved', submittedAt: '2026-06-01' },
  { id: 'tor-4', employeeId: 'emp-7', employeeName: 'Morgan Davis',    avatarColor: '#a855f7', leaveType: 'Vacation',   startDate: '2026-07-04', endDate: '2026-07-11', hours: 60, reason: 'Summer holiday',           status: 'approved', submittedAt: '2026-05-20' },
  { id: 'tor-5', employeeId: 'emp-3', employeeName: 'Priya Patel',     avatarColor: '#8b5cf6', leaveType: 'Sick Leave', startDate: '2026-06-06', endDate: '2026-06-07', hours: 24, reason: 'Flu',                      status: 'denied',   submittedAt: '2026-06-05' },
  { id: 'tor-6', employeeId: 'emp-8', employeeName: 'Riley Martinez',  avatarColor: '#ec4899', leaveType: 'Bereavement',startDate: '2026-06-10', endDate: '2026-06-13', hours: 32, reason: 'Family bereavement',       status: 'pending',  submittedAt: '2026-06-04' },
  { id: 'tor-7', employeeId: 'emp-5', employeeName: 'Alex Johnson',    avatarColor: '#22c55e', leaveType: 'Vacation',   startDate: '2026-06-27', endDate: '2026-06-28', hours: 16, reason: 'Weekend trip extension',    status: 'pending',  submittedAt: '2026-06-02' },
];

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
  const { setOrg, copilotOpen } = useAppStore();
  const [requests, setRequests] = useState<TimeOffRequest[]>(MOCK_REQUESTS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  useEffect(() => { setOrg(mockOrg); }, []);

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  function approve(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
  }
  function deny(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' } : r));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Time Off"
          subtitle={`${pendingCount} request${pendingCount !== 1 ? 's' : ''} pending approval`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs">
              New Request
            </Button>
          }
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Pending',  value: requests.filter(r => r.status === 'pending').length,  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
                { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
                { label: 'Denied',   value: requests.filter(r => r.status === 'denied').length,   color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
                { label: 'Total',    value: requests.length,                                       color: 'text-gray-700',   bg: 'bg-white',     border: 'border-gray-200' },
              ].map(card => (
                <div key={card.label} className={cn('rounded-xl border p-4', card.bg, card.border)}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
                  <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
              {(['all', 'pending', 'approved', 'denied'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all',
                    filter === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Requests list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Employee', 'Leave Type', 'Dates', 'Hours', 'Reason', 'Submitted', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar firstName={req.employeeName.split(' ')[0]} lastName={req.employeeName.split(' ')[1]} color={req.avatarColor} size="sm" />
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
                      <td className="py-3 px-4 text-gray-700">{req.hours}h</td>
                      <td className="py-3 px-4 text-gray-600 max-w-[160px] truncate">{req.reason}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{req.submittedAt}</td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_MAP[req.status].variant}>{STATUS_MAP[req.status].label}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => approve(req.id)}
                              className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors border border-green-200"
                            >
                              <Check size={11} /> Approve
                            </button>
                            <button
                              onClick={() => deny(req.id)}
                              className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                            >
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

              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <Clock size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No {filter === 'all' ? '' : filter} requests</p>
                </div>
              )}
            </div>
          </div>
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>
    </div>
  );
}
