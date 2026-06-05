'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { WeekView } from '@/components/calendar/week-view';
import { ShiftDetailPanel } from '@/components/calendar/shift-detail-panel';
import { EditShiftModal } from '@/components/calendar/edit-shift-modal';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { useAppStore, useCalendarStore } from '@/store';
import { mockOrg, mockShifts, mockSchedule } from '@/lib/mock-data';
import type { Shift } from '@/types';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';

export default function SchedulePage() {
  const { setOrg, copilotOpen, setActiveSchedule } = useAppStore();
  const { view } = useCalendarStore();

  const [shifts, setShifts] = useState<Shift[]>(mockShifts);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [modalMode, setModalMode] = useState<'edit' | 'delete' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedule, setSchedule] = useState(mockSchedule);

  useEffect(() => {
    setOrg(mockOrg);
    setActiveSchedule(mockSchedule.id);
  }, []);

  function handleShiftClick(shift: Shift) {
    setSelectedShift(shift);
    setModalMode(null);
  }

  function handleGenerate() {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setSchedule(s => ({ ...s, status: 'review' }));
    }, 3500);
  }

  function handlePublish() {
    setSchedule(s => ({ ...s, status: 'published' }));
  }

  function handleSaveShift(updated: Partial<Shift>) {
    setShifts(prev => prev.map(s =>
      s.id === selectedShift?.id ? { ...s, ...updated } : s
    ));
    // Reflect changes in the selected panel
    setSelectedShift(prev => prev ? { ...prev, ...updated } : null);
    setModalMode(null);
  }

  function handleDeleteShift(shiftId: string) {
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    setSelectedShift(null);
    setModalMode(null);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Schedule"
          subtitle={`${schedule.name} · ${schedule.status === 'published' ? 'Published' : 'Draft'}`}
          actions={
            <>
              <Button variant="secondary" size="sm" leftIcon={<Download size={13} />} className="text-xs">
                Export
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<Plus size={13} />} className="text-xs">
                New Shift
              </Button>
            </>
          }
        />

        {/* AI generation banner */}
        {isGenerating && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 flex items-center gap-3">
            <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            <p className="text-sm font-medium">AI is generating your schedule — analyzing constraints, optimizing assignments…</p>
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Calendar */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <CalendarToolbar
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              scheduleStatus={schedule.status}
              onPublish={handlePublish}
            />
            <div className="flex-1 overflow-hidden">
              {view === 'week' || view === 'department' || view === 'timeline' ? (
                <WeekView
                  shifts={shifts}
                  onShiftClick={handleShiftClick}
                  onCreateShift={date => console.log('Create shift on', date)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm">{view.charAt(0).toUpperCase() + view.slice(1)} view — coming soon</p>
                </div>
              )}
            </div>
          </div>

          {/* Shift detail panel */}
          {selectedShift && !copilotOpen && (
            <ShiftDetailPanel
              shift={selectedShift}
              onClose={() => setSelectedShift(null)}
              onEdit={() => setModalMode('edit')}
              onDelete={() => setModalMode('delete')}
            />
          )}

          {/* Copilot panel */}
          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {/* Edit / Delete modal */}
      {selectedShift && (modalMode === 'edit' || modalMode === 'delete') && (
        <EditShiftModal
          shift={selectedShift}
          mode={modalMode}
          onSave={handleSaveShift}
          onDelete={handleDeleteShift}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
}
