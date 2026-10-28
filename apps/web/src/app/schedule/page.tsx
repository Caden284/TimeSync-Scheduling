'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { WeekView } from '@/components/calendar/week-view';
import { DayView } from '@/components/calendar/day-view';
import { MonthView } from '@/components/calendar/month-view';
import { TimelineView } from '@/components/calendar/timeline-view';
import { StaffTimelineView } from '@/components/calendar/staff-timeline-view';
import { ShiftDetailPanel } from '@/components/calendar/shift-detail-panel';
import { EditShiftModal } from '@/components/calendar/edit-shift-modal';
import { NewShiftModal } from '@/components/calendar/new-shift-modal';
import { AutoScheduleModal } from '@/components/calendar/auto-schedule-modal';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { Modal } from '@/components/ui/modal';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAppStore, useCalendarStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { getShifts, createShift, updateShift, deleteShift, getWeekSchedule, setWeekStatus } from '@/lib/db';
import { rowToShift } from '@/lib/scheduling';
import { generateFromPresets } from '@/lib/presets';
import { toISODate, parseISODate, weekRange } from '@/lib/dates';
import type { Shift } from '@/types';
import { Button } from '@/components/ui/button';
import { Plus, Download, Sparkles } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

// ── PDF export ───────────────────────────────────────────────────────────────

// Everything written into the export window is user data — escape it so a
// shift title can't inject markup or script into the app's origin.
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function exportSchedulePDF(shifts: Shift[], rangeLabel: string, orgName: string) {
  const win = window.open('', '_blank');
  if (!win) return false;

  const rows = [...shifts]
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .map(s => {
      const names = (s.assignedEmployeeNames ?? []).map(esc).join(', ');
      const open = (s.assignedEmployeeIds?.length ?? 0) < s.minStaff;
      return `
    <tr>
      <td>${esc(s.title ?? 'Shift')}</td>
      <td>${esc(s.date)}</td>
      <td>${esc(s.startTime.slice(0, 5))} – ${esc(s.endTime.slice(0, 5))}</td>
      <td>${esc(s.department?.name || '—')}</td>
      <td>${esc(s.location?.name || '—')}</td>
      <td>${names || '<span style="color:#b45309">Unfilled</span>'}</td>
      <td style="text-align:center">${esc(s.assignedEmployeeIds?.length ?? 0)}/${esc(s.minStaff)}</td>
      <td><span style="padding:2px 8px;border-radius:12px;font-size:11px;background:${open ? '#fef3c7' : '#d1fae5'};color:${open ? '#92400e' : '#065f46'}">${open ? 'Needs staff' : 'Staffed'}</span></td>
    </tr>`;
    }).join('');

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${esc(orgName)} — Schedule ${esc(rangeLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #6366f1; }
    .logo { font-size: 22px; font-weight: 800; color: #6366f1; }
    .meta { font-size: 12px; color: #6b7280; text-align: right; }
    h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 9px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">⚡ TimeSync</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">${esc(orgName)}</div>
    </div>
    <div class="meta">
      Schedule: <strong>${esc(rangeLabel)}</strong><br/>
      Generated: ${esc(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}<br/>
      Total shifts: <strong>${shifts.length}</strong>
    </div>
  </div>
  <h2>Shift Schedule — ${esc(rangeLabel)}</h2>
  <table>
    <thead>
      <tr><th>Shift</th><th>Date</th><th>Time</th><th>Department</th><th>Location</th><th>Assigned To</th><th style="text-align:center">Staff</th><th>Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated by TimeSync Scheduling</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  win.document.close();
  return true;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { copilotOpen, addToast } = useAppStore();
  const { view, currentDate } = useCalendarStore();
  const { profile } = useAuth();
  const { org } = useOrgData();

  const { cachedShifts, cachedWeekKey, setCachedShifts, addCachedShift, updateCachedShift, removeCachedShift } = useAppStore();
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [modalMode, setModalMode]       = useState<'edit' | 'delete' | null>(null);
  const [showNewShift, setShowNewShift] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState<string | undefined>();
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [weekStatus, setWeekStatusState] = useState<'draft' | 'published' | undefined>();
  const [publishing, setPublishing]     = useState(false);
  const [confirmPublish, setConfirmPublish] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [fillingPreset, setFillingPreset] = useState(false);

  // The week the toolbar's Publish / Auto-Schedule act on.
  const week = weekRange(currentDate);

  // Fetch exactly what the current view displays (the month view needs
  // whole weeks around the month, not just the current week).
  const range = useMemo(() => {
    if (view === 'month') {
      const d = parseISODate(currentDate);
      return {
        from: toISODate(startOfWeek(startOfMonth(d), { weekStartsOn: 0 })),
        to:   toISODate(endOfWeek(endOfMonth(d), { weekStartsOn: 0 })),
      };
    }
    return { from: week.start, to: week.end };
  }, [view, currentDate, week.start, week.end]);

  const rangeKey = `${profile?.orgId ?? 'none'}:${range.from}:${range.to}`;

  useEffect(() => {
    if (!profile?.orgId || cachedWeekKey === rangeKey) return;
    getShifts(profile.orgId, range.from, range.to)
      .then(docs => setCachedShifts(rangeKey, docs.map(d => rowToShift(d))))
      .catch(() => {
        setCachedShifts(rangeKey, []);
        addToast({ type: 'error', title: 'Failed to load shifts', message: 'Check your connection and try refreshing.' });
      });
  }, [profile?.orgId, rangeKey, reloadTick]);

  useEffect(() => {
    if (!profile?.orgId) return;
    setWeekStatusState(undefined);
    getWeekSchedule(profile.orgId, week.start)
      .then(s => setWeekStatusState(s?.status === 'published' ? 'published' : 'draft'))
      .catch(() => setWeekStatusState('draft'));
  }, [profile?.orgId, week.start]);

  const shifts = cachedWeekKey === rangeKey ? cachedShifts : [];
  const selectedShift = shifts.find(s => s.id === selectedShiftId) ?? null;
  const weekShifts = shifts.filter(s => s.date >= week.start && s.date <= week.end);

  const weekLabel = `${format(parseISODate(week.start), 'MMM d')} – ${format(parseISODate(week.end), 'MMM d, yyyy')}`;
  const rangeLabel = view === 'month' ? format(parseISODate(currentDate), 'MMMM yyyy') : weekLabel;
  const orgName = org?.name ?? 'TimeSync';

  // Refetch after something outside this page (the AI Copilot) changed shifts.
  function refreshRange() {
    setCachedShifts('', []);
    setReloadTick(t => t + 1);
  }

  // Pre-set → slots for the week shown, then straight into Auto-Schedule's
  // preview so the admin can assign people in one pass.
  async function fillFromPreset() {
    if (!profile?.orgId) return;
    setFillingPreset(true);
    try {
      const { created, skipped, seasons } = await generateFromPresets(profile.orgId, week.start, week.end);
      if (!seasons.length) {
        addToast({ type: 'warning', title: 'No season covers this week', message: 'Create a season and its pre-set schedule under Seasons first.' });
        return;
      }
      if (created + skipped === 0) {
        addToast({ type: 'warning', title: 'The pre-set is empty', message: `Add slots to ${seasons.join(', ')} under Seasons.` });
        return;
      }
      addToast({
        type: 'success',
        title: created ? `Added ${created} slot${created === 1 ? '' : 's'} from ${seasons.join(', ')}` : 'This week already has its pre-set slots',
        message: 'Review who Auto-Schedule picks, then confirm.',
      });
      refreshRange();
      setShowAutoSchedule(true);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not fill from the pre-set', message: e?.message });
    } finally {
      setFillingPreset(false);
    }
  }

  function handleCreateShift(date?: string) {
    setNewShiftDate(date);
    setShowNewShift(true);
  }

  async function handleNewShiftSave(partial: any) {
    if (!profile?.orgId) return;
    try {
      const doc = await createShift({
        orgId: profile.orgId,
        title: partial.title,
        date: partial.date,
        startTime: partial.startTime,
        endTime: partial.endTime,
        departmentId: partial.departmentId,
        departmentName: partial.department?.name,
        departmentColor: partial.department?.color,
        locationId: partial.locationId,
        locationName: partial.location?.name,
        shiftType: partial.shiftType ?? 'fixed',
        status: 'open',
        isOpen: true,
        minStaff: partial.minStaff ?? 1,
        maxStaff: partial.maxStaff,
        color: partial.color,
        notes: partial.notes,
        taskTypeId: partial.taskTypeId,
      });
      if (doc.date >= range.from && doc.date <= range.to) addCachedShift(rowToShift(doc));
      setSelectedShiftId(doc.id);
      addToast({ type: 'success', title: 'Shift created', message: 'Use "Assign" to add staff.' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to create shift', message: e?.message });
    }
  }

  async function handleSaveShift(updated: Partial<Shift> & Record<string, any>) {
    if (!selectedShift) return;
    setModalMode(null);
    try {
      const row = await updateShift(selectedShift.id, {
        title: updated.title ?? null,
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        departmentId: updated.departmentId ?? null,
        departmentName: updated.departmentName ?? null,
        departmentColor: updated.departmentColor ?? null,
        locationId: updated.locationId ?? null,
        locationName: updated.locationName ?? null,
        shiftType: updated.shiftType,
        minStaff: updated.minStaff,
        maxStaff: updated.maxStaff ?? null,
        isOpen: (selectedShift.assignedEmployeeIds?.length ?? 0) < (updated.minStaff ?? selectedShift.minStaff),
        color: updated.color,
        notes: updated.notes ?? null,
        ...('taskTypeId' in updated ? { taskTypeId: updated.taskTypeId || null } : {}),
      });
      updateCachedShift(selectedShift.id, rowToShift(row));
      addToast({ type: 'success', title: 'Shift updated' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to update shift', message: e?.message });
    }
  }

  async function handleDeleteShift(shiftId: string) {
    setModalMode(null);
    try {
      await deleteShift(shiftId);
      removeCachedShift(shiftId);
      setSelectedShiftId(null);
      addToast({ type: 'success', title: 'Shift deleted' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to delete shift', message: e?.message });
    }
  }

  function requestPublish() {
    const understaffed = weekShifts.filter(s => (s.assignedEmployeeIds?.length ?? 0) < s.minStaff).length;
    if (weekShifts.length === 0) {
      addToast({ type: 'warning', title: 'Nothing to publish', message: 'Add shifts to this week first.' });
      return;
    }
    if (understaffed > 0) setConfirmPublish(understaffed);
    else publish('published');
  }

  async function publish(status: 'draft' | 'published') {
    if (!profile?.orgId) return;
    setConfirmPublish(null);
    setPublishing(true);
    try {
      await setWeekStatus(profile.orgId, week.start, week.end, status);
      setWeekStatusState(status);
      addToast(status === 'published'
        ? { type: 'success', title: 'Week published', message: 'Staff can now see their shifts and have been notified.' }
        : { type: 'info', title: 'Week unpublished', message: 'Staff can no longer see this week.' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not update the schedule', message: e?.message });
    } finally {
      setPublishing(false);
    }
  }

  function handleExportPDF() {
    if (!exportSchedulePDF(shifts, rangeLabel, orgName)) {
      addToast({ type: 'warning', title: 'Pop-up blocked', message: 'Allow pop-ups for this site to export.' });
    }
  }

  const viewProps = { shifts, onShiftClick: (s: Shift) => { setSelectedShiftId(s.id); setModalMode(null); }, onCreateShift: handleCreateShift };

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Schedule"
          subtitle={`${weekLabel} · ${weekStatus === 'published' ? 'Published' : weekStatus === 'draft' ? 'Draft — staff can’t see it yet' : '…'}`}
          actions={
            <>
              <Button variant="secondary" size="sm" leftIcon={<Download size={13} />} className="text-xs" onClick={handleExportPDF}>
                Export PDF
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs" onClick={() => handleCreateShift()}>
                New Shift
              </Button>
            </>
          }
        />

        {org && !org.onboardingCompletedAt && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2.5 flex items-center gap-3 text-sm">
            <Sparkles size={15} className="text-indigo-500 shrink-0" />
            <p className="text-indigo-900 flex-1">Finish setting up {org.name}: add your departments, locations, and team.</p>
            <Link href="/onboarding" className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">Continue setup →</Link>
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <CalendarToolbar
              onFillPreset={fillFromPreset}
              isFillingPreset={fillingPreset}
              onGenerate={() => setShowAutoSchedule(true)}
              isGenerating={showAutoSchedule}
              scheduleStatus={weekStatus}
              onPublish={requestPublish}
              onUnpublish={() => publish('draft')}
              isPublishing={publishing}
            />
            <div className="flex-1 overflow-hidden">
              {(view === 'week' || view === 'department' || view === 'role' || view === 'location') && <WeekView {...viewProps} />}
              {view === 'day' && <DayView {...viewProps} />}
              {view === 'month' && <MonthView {...viewProps} />}
              {view === 'timeline' && <TimelineView {...viewProps} />}
              {view === 'staff_timeline' && <StaffTimelineView shifts={shifts} onShiftClick={viewProps.onShiftClick} />}
            </div>
          </div>

          {selectedShift && !copilotOpen && (
            <ShiftDetailPanel
              shift={selectedShift}
              onClose={() => setSelectedShiftId(null)}
              onEdit={() => setModalMode('edit')}
              onDelete={() => setModalMode('delete')}
              onShiftUpdated={row => updateCachedShift(row.id, rowToShift(row))}
            />
          )}

          {copilotOpen && <CopilotPanel onScheduleChanged={refreshRange} />}
        </div>
      </div>

      {showNewShift && (
        <NewShiftModal defaultDate={newShiftDate} onSave={handleNewShiftSave} onClose={() => setShowNewShift(false)} />
      )}

      {selectedShift && (modalMode === 'edit' || modalMode === 'delete') && (
        <EditShiftModal shift={selectedShift} mode={modalMode} onSave={handleSaveShift} onDelete={handleDeleteShift} onClose={() => setModalMode(null)} />
      )}

      {showAutoSchedule && (
        <AutoScheduleModal
          weekStart={week.start}
          weekEnd={week.end}
          weekLabel={weekLabel}
          onClose={() => setShowAutoSchedule(false)}
          onApplied={rows => {
            rows.forEach(r => updateCachedShift(r.id, rowToShift(r)));
            setShowAutoSchedule(false);
            addToast({ type: 'success', title: 'Schedule filled', message: `Updated ${rows.length} shift${rows.length === 1 ? '' : 's'}.` });
          }}
        />
      )}

      {confirmPublish !== null && (
        <Modal title="Publish with open shifts?" onClose={() => setConfirmPublish(null)} size="sm"
          footer={<>
            <Button variant="secondary" size="sm" onClick={() => { setConfirmPublish(null); setShowAutoSchedule(true); }}>Auto-Schedule first</Button>
            <Button variant="success" size="sm" onClick={() => publish('published')}>Publish anyway</Button>
          </>}>
          <p className="text-sm text-gray-700">
            {confirmPublish} shift{confirmPublish === 1 ? ' is' : 's are'} below minimum staff this week.
            Staff will see the schedule as it is now.
          </p>
        </Modal>
      )}
    </div>
    </AuthGuard>
  );
}
