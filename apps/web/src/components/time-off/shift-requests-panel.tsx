'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { supabase, TABLES, fromRow } from '@/lib/supabase';
import { decideShiftRequest, getShiftRequests } from '@/lib/db';
import { parseISODate } from '@/lib/dates';
import type { ShiftRequest } from '@/types';

const STATUS: Record<ShiftRequest['status'], { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  denied: { label: 'Denied', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

// Staff asking to give away a published shift. Approving takes them off it,
// which re-opens the shift for Auto-Schedule or open-shift pickup.
export function ShiftRequestsPanel({ orgId, onPendingCount }: { orgId: string; onPendingCount: (n: number) => void }) {
  const { addToast } = useAppStore();
  const [requests, setRequests] = useState<ShiftRequest[] | null>(null);
  const [shifts, setShifts] = useState<Map<string, any>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await getShiftRequests(orgId);
      setRequests(rows);
      onPendingCount(rows.filter(r => r.status === 'pending').length);
      const ids = [...new Set(rows.map(r => r.shiftId))];
      if (ids.length) {
        const { data } = await supabase.from(TABLES.SHIFTS).select('id, title, date, start_time, end_time').in('id', ids);
        setShifts(new Map((data ?? []).map(r => [r.id, fromRow(r)])));
      }
    } catch (e: any) {
      setRequests([]);
      addToast({ type: 'error', title: 'Could not load give-away requests', message: e?.message });
    }
  }
  useEffect(() => { load(); }, [orgId]);

  async function decide(r: ShiftRequest, status: 'approved' | 'denied') {
    setBusy(r.id);
    try {
      await decideShiftRequest(r, status);
      addToast({ type: 'success', title: status === 'approved' ? `${r.employeeName} is off the shift` : 'Request denied', message: status === 'approved' ? 'The shift is open again.' : undefined });
      await load();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not update the request', message: e?.message });
    } finally {
      setBusy(null);
    }
  }

  if (!requests) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" size={18} /></div>;
  if (!requests.length) {
    return <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No one has asked to give away a shift.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="py-3 px-4">Employee</th>
            <th className="py-3 px-4">Shift</th>
            <th className="py-3 px-4">Reason</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {requests.map(r => {
            const s = shifts.get(r.shiftId);
            return (
              <tr key={r.id}>
                <td className="py-3 px-4 font-medium text-gray-900">{r.employeeName}</td>
                <td className="py-3 px-4 text-gray-700">
                  {s ? <>{s.title ?? 'Shift'}<span className="block text-xs text-gray-500">{format(parseISODate(s.date), 'EEE MMM d')} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</span></> : 'Deleted shift'}
                </td>
                <td className="py-3 px-4 text-gray-600 max-w-xs">{r.note || '—'}</td>
                <td className="py-3 px-4"><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></td>
                <td className="py-3 px-4">
                  {r.status === 'pending' && (
                    <div className="flex justify-end gap-1.5">
                      <Button variant="success" size="xs" leftIcon={<Check size={12} />} loading={busy === r.id} onClick={() => decide(r, 'approved')}>Approve</Button>
                      <Button variant="secondary" size="xs" leftIcon={<X size={12} />} disabled={busy === r.id} onClick={() => decide(r, 'denied')}>Deny</Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
