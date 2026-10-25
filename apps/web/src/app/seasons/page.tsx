'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import { Modal, inputCls, labelCls } from '@/components/ui/modal';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { useAppStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { createShifts } from '@/lib/db';
import { parseISODate, toISODate } from '@/lib/dates';
import {
  getSeasons, createSeason, updateSeason, deleteSeason,
  getShiftTemplates, createShiftTemplate, updateShiftTemplate, deleteShiftTemplate,
} from '@/lib/db';
import type { Season, ShiftTemplate, SeasonType, WeeklyAvailability } from '@/types';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Edit2, ChevronRight, Loader2, Clock, CalendarDays, Layers,
} from 'lucide-react';

const SEASON_LABELS: Record<SeasonType, string> = {
  fall:               'Fall',
  spring:             'Spring',
  fall_intersession:  'Fall Intersession',
  spring_intersession:'Spring Intersession',
  summer:             'Summer Hours',
  summer_intersession:'Summer Intersession',
};

const SEASON_COLORS: Record<SeasonType, string> = {
  fall:               '#f59e0b',
  spring:             '#10b981',
  fall_intersession:  '#f97316',
  spring_intersession:'#84cc16',
  summer:             '#3b82f6',
  summer_intersession:'#8b5cf6',
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_LABELS: Record<string, string> = { sun: 'Su', mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa' };

const BLANK_HOURS = {
  sun: { start: '', end: '' }, mon: { start: '07:00', end: '22:00' },
  tue: { start: '07:00', end: '22:00' }, wed: { start: '07:00', end: '22:00' },
  thu: { start: '07:00', end: '22:00' }, fri: { start: '07:00', end: '22:00' },
  sat: { start: '10:00', end: '18:00' },
};

const TEMPLATE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const ALL_DAYS = [0,1,2,3,4,5,6];
const WEEKDAYS = [1,2,3,4,5];

// ── Season form modal ─────────────────────────────────────────────────────────

function SeasonModal({ season, onClose, onSaved }: { season?: Season; onClose: () => void; onSaved: (s: Season) => void }) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(season?.name ?? '');
  const [seasonType, setSeasonType] = useState<SeasonType>(season?.seasonType ?? 'fall');
  const [startDate, setStartDate] = useState(season?.startDate ?? '');
  const [endDate, setEndDate] = useState(season?.endDate ?? '');
  const [hours, setHours] = useState(season?.hours ?? BLANK_HOURS);

  function setDayHour(day: string, field: 'start' | 'end', val: string) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day as keyof typeof prev], [field]: val } }));
  }

  function toggleDay(day: string) {
    const isOn = (hours as any)[day].start !== '';
    setHours(prev => ({ ...prev, [day]: isOn ? { start: '', end: '' } : { start: '09:00', end: '17:00' } }));
  }

  async function handleSave() {
    if (!name.trim() || !startDate || !endDate) { setError('Name and date range are required.'); return; }
    if (!profile?.orgId) return;
    setSaving(true); setError('');
    try {
      const payload = { name, seasonType, startDate, endDate, hoursJson: JSON.stringify(hours) };
      let saved: Season;
      if (season) {
        saved = await updateSeason(season.id, payload) as Season;
      } else {
        saved = await createSeason(profile.orgId, payload) as Season;
      }
      onSaved(saved);
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={season ? 'Edit Season' : 'New Season'} onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          {season ? 'Save Changes' : 'Create Season'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelCls}>Season Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Fall 2026" />
        </div>

        <div>
          <label className={labelCls}>Season Type</label>
          <select value={seasonType} onChange={e => setSeasonType(e.target.value as SeasonType)} className={inputCls}>
            {(Object.keys(SEASON_LABELS) as SeasonType[]).map(t => (
              <option key={t} value={t}>{SEASON_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Operating Hours</label>
          <p className="text-xs text-gray-400 mb-2">Leave start empty to mark day as closed.</p>
          <div className="space-y-1.5">
            {DAY_KEYS.map(day => {
              const h = (hours as any)[day];
              const isOpen = h.start !== '';
              return (
                <div key={day} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2', isOpen ? 'bg-indigo-50/50' : 'bg-gray-50')}>
                  <button onClick={() => toggleDay(day)} className={cn('relative rounded-full transition-colors flex-shrink-0', isOpen ? 'bg-indigo-500' : 'bg-gray-300')} style={{ height: 16, width: 28 }}>
                    <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all', isOpen ? 'left-[12px]' : 'left-[2px]')} />
                  </button>
                  <span className={cn('w-6 text-xs font-semibold', isOpen ? 'text-gray-700' : 'text-gray-400')}>{DAY_LABELS[day]}</span>
                  {isOpen ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input type="time" value={h.start} onChange={e => setDayHour(day, 'start', e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      <span className="text-gray-300 text-xs">–</span>
                      <input type="time" value={h.end} onChange={e => setDayHour(day, 'end', e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Template form modal ───────────────────────────────────────────────────────

function TemplateModal({ template, seasonId, orgId, onClose, onSaved }: {
  template?: ShiftTemplate; seasonId: string; orgId: string; onClose: () => void; onSaved: (t: ShiftTemplate) => void;
}) {
  const { departments } = useOrgData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(template?.name ?? '');
  const [startTime, setStartTime] = useState(template?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(template?.endTime ?? '12:00');
  const [color, setColor] = useState(template?.color ?? TEMPLATE_COLORS[0]);
  const [departmentId, setDepartmentId] = useState(template?.departmentId ?? '');
  const [minStaff, setMinStaff] = useState(template?.minStaff ?? 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(template?.daysOfWeek ?? WEEKDAYS);
  const [notes, setNotes] = useState(template?.notes ?? '');

  function toggleDow(d: number) {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  const DOW_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (daysOfWeek.length === 0) { setError('Select at least one day.'); return; }
    setSaving(true); setError('');
    try {
      const deptName = departments.find(d => d.id === departmentId)?.name ?? '';
      const payload = { name, startTime, endTime, color, departmentId: departmentId || undefined, departmentName: deptName || undefined, minStaff, daysOfWeek, notes: notes || undefined };
      let saved: ShiftTemplate;
      if (template) {
        saved = await updateShiftTemplate(template.id, payload) as ShiftTemplate;
      } else {
        saved = await createShiftTemplate(orgId, { seasonId, ...payload }) as ShiftTemplate;
      }
      onSaved(saved);
    } catch (e: any) { setError(e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={template ? 'Edit Template' : 'New Shift Template'} onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          {template ? 'Save Changes' : 'Create Template'}
        </Button>
      </>}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className={labelCls}>Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. #LN1 Desk, Morning Reference, Circulation" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start Time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Time</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Days of Week</label>
          <div className="flex gap-1.5 mt-1">
            {ALL_DAYS.map(d => (
              <button key={d} onClick={() => toggleDow(d)} className={cn(
                'w-9 h-9 rounded-lg text-xs font-semibold transition-all border',
                daysOfWeek.includes(d)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              )}>
                {DOW_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Department</label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className={inputCls}>
              <option value="">No department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Min Staff</label>
            <input type="number" min="1" max="50" value={minStaff} onChange={e => setMinStaff(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Color</label>
          <div className="flex gap-2 mt-1">
            {TEMPLATE_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full transition-all', color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105')} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Any special instructions for this shift…" />
        </div>
      </div>
    </Modal>
  );
}

// ── Generate modal ────────────────────────────────────────────────────────────

function GenerateModal({ season, templates, orgId, onClose, onGenerated }: {
  season: Season; templates: ShiftTemplate[]; orgId: string; onClose: () => void; onGenerated: (count: number) => void;
}) {
  const { addToast } = useAppStore();
  const [startDate, setStartDate] = useState(season.startDate);
  const [endDate, setEndDate] = useState(season.endDate);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!startDate || !endDate) return;
    setGenerating(true);
    try {
      // Build every shift locally, then insert in one request. Each row carries
      // its template id, so re-running a range skips shifts that already exist.
      const rows: Record<string, unknown>[] = [];
      const end = parseISODate(endDate);
      for (let d = parseISODate(startDate); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // 0=Sun
        const dateStr = toISODate(d);
        for (const tmpl of templates.filter(t => t.isActive && t.daysOfWeek.includes(dow))) {
          rows.push({
            orgId, templateId: tmpl.id, title: tmpl.name, date: dateStr,
            startTime: tmpl.startTime, endTime: tmpl.endTime,
            departmentId: tmpl.departmentId, departmentName: tmpl.departmentName,
            departmentColor: tmpl.color, shiftType: 'fixed', status: 'open',
            isOpen: true, minStaff: tmpl.minStaff, color: tmpl.color,
          });
        }
      }
      const count = await createShifts(rows);
      const skipped = rows.length - count;
      onGenerated(count);
      addToast({
        type: 'success',
        title: `Generated ${count} shift${count === 1 ? '' : 's'}`,
        message: skipped > 0 ? `${skipped} already existed and were skipped.` : `${startDate} → ${endDate}`,
      });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Generation failed', message: e?.message });
    } finally {
      setGenerating(false);
      onClose();
    }
  }

  const activeTemplates = templates.filter(t => t.isActive);

  return (
    <Modal title="Generate Shifts from Templates" onClose={onClose}
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="ai" size="sm" onClick={handleGenerate} loading={generating}>
          {generating ? 'Generating…' : `Generate Shifts`}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">
          <p className="font-semibold mb-1">Season: {season.name}</p>
          <p>{activeTemplates.length} active template{activeTemplates.length !== 1 ? 's' : ''} · {activeTemplates.map(t => t.name).join(', ')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={season.startDate} max={season.endDate} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={season.startDate} max={season.endDate} className={inputCls} />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          This creates one unfilled shift per template per matching day of week. The AI Copilot can then assign employees to fill them.
        </p>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeasonsPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | undefined>();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | undefined>();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    getSeasons(profile.orgId)
      .then(setSeasons)
      .catch(() => addToast({ type: 'error', title: 'Failed to load seasons' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  useEffect(() => {
    if (!selectedSeason || !profile?.orgId) return;
    setLoadingTemplates(true);
    getShiftTemplates(profile.orgId, selectedSeason.id)
      .then(setTemplates)
      .catch(() => addToast({ type: 'error', title: 'Failed to load templates' }))
      .finally(() => setLoadingTemplates(false));
  }, [selectedSeason?.id, profile?.orgId]);

  async function handleDeleteSeason(s: Season) {
    if (!confirm(`Delete season "${s.name}"? This does not delete generated shifts.`)) return;
    setDeletingId(s.id);
    try {
      await deleteSeason(s.id);
      setSeasons(prev => prev.filter(x => x.id !== s.id));
      if (selectedSeason?.id === s.id) setSelectedSeason(null);
      addToast({ type: 'success', title: 'Season deleted' });
    } catch { addToast({ type: 'error', title: 'Failed to delete' }); }
    finally { setDeletingId(null); }
  }

  async function handleDeleteTemplate(t: ShiftTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    setDeletingId(t.id);
    try {
      await deleteShiftTemplate(t.id);
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      addToast({ type: 'success', title: 'Template deleted' });
    } catch { addToast({ type: 'error', title: 'Failed to delete' }); }
    finally { setDeletingId(null); }
  }

  const seasonTemplates = selectedSeason ? templates : [];

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Seasons & Templates"
          subtitle="Define seasonal hours and reusable shift templates"
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs" onClick={() => { setEditingSeason(undefined); setShowSeasonModal(true); }}>
              New Season
            </Button>
          }
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Season list */}
          <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Seasons</h2>
              <span className="text-xs text-gray-400">{seasons.length}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center flex-1 gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : seasons.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                <CalendarDays size={32} className="text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-medium">No seasons yet</p>
                <p className="text-xs text-gray-400 mt-1">Create a season to define operating hours and shift templates.</p>
                <Button variant="primary" size="sm" className="mt-4 text-xs" leftIcon={<Plus size={12} />} onClick={() => setShowSeasonModal(true)}>
                  New Season
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {seasons.map(s => {
                  const color = SEASON_COLORS[s.seasonType] ?? '#6366f1';
                  const isSelected = selectedSeason?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeason(s)}
                      className={cn(
                        'w-full text-left rounded-xl px-3 py-2.5 transition-all group',
                        isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                          <div className="min-w-0">
                            <p className={cn('text-sm font-semibold truncate', isSelected ? 'text-indigo-700' : 'text-gray-800')}>{s.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{s.startDate} → {s.endDate}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); setEditingSeason(s); setShowSeasonModal(true); }} className="p-1 text-gray-400 hover:text-indigo-600">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteSeason(s); }} disabled={deletingId === s.id} className="p-1 text-gray-400 hover:text-red-500">
                            {deletingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {DAY_KEYS.map(d => {
                          const h = s.hours[d];
                          return (
                            <span key={d} className={cn('text-[9px] px-1 rounded', h.start ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>
                              {DAY_LABELS[d]}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Templates panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedSeason ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
                <Layers size={40} className="text-gray-200 mb-4" />
                <p className="text-sm text-gray-500 font-medium">Select a season to manage its shift templates</p>
                <p className="text-xs text-gray-400 mt-1">Shift templates are reusable definitions that generate your weekly schedule.</p>
              </div>
            ) : (
              <>
                {/* Templates header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">{selectedSeason.name} — Shift Templates</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{SEASON_LABELS[selectedSeason.seasonType]} · {selectedSeason.startDate} to {selectedSeason.endDate}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="text-xs" leftIcon={<Clock size={12} />}
                      onClick={() => setShowGenerateModal(true)}>
                      Generate Shifts
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
                      onClick={() => { setEditingTemplate(undefined); setShowTemplateModal(true); }}>
                      New Template
                    </Button>
                  </div>
                </div>

                {/* Hours summary */}
                <div className="px-6 py-3 bg-white border-b border-gray-50">
                  <div className="flex gap-3 flex-wrap">
                    {DAY_KEYS.map(d => {
                      const h = selectedSeason.hours[d];
                      return (
                        <div key={d} className={cn('text-xs rounded-lg px-2.5 py-1.5 flex items-center gap-1.5', h.start ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400')}>
                          <span className="font-semibold">{DAY_LABELS[d]}</span>
                          {h.start ? <span>{h.start}–{h.end}</span> : <span>Closed</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Templates grid */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Loading templates…</span>
                    </div>
                  ) : seasonTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Clock size={36} className="text-gray-200 mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No templates for this season</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">Add shift templates to define the recurring positions that need to be filled each week.</p>
                      <Button variant="primary" size="sm" className="mt-4 text-xs" leftIcon={<Plus size={12} />}
                        onClick={() => { setEditingTemplate(undefined); setShowTemplateModal(true); }}>
                        Add First Template
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {seasonTemplates.map(t => {
                        const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                        return (
                          <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all group">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                <p className="text-sm font-bold text-gray-900 truncate">{t.name}</p>
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }} className="p-1 text-gray-400 hover:text-indigo-600">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDeleteTemplate(t)} disabled={deletingId === t.id} className="p-1 text-gray-400 hover:text-red-500">
                                  {deletingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Clock size={11} className="text-gray-400" />
                                <span>{t.startTime} – {t.endTime}</span>
                              </div>
                              {t.departmentName && (
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: t.color }} />
                                  <span>{t.departmentName}</span>
                                </div>
                              )}
                              <div className="flex gap-1 mt-2">
                                {ALL_DAYS.map(d => (
                                  <span key={d} className={cn('px-1 py-0.5 rounded text-[9px] font-semibold', t.daysOfWeek.includes(d) ? 'text-white' : 'text-gray-300 bg-gray-50')} style={t.daysOfWeek.includes(d) ? { backgroundColor: t.color } : {}}>
                                    {DOW[d]}
                                  </span>
                                ))}
                              </div>
                              <p className="text-gray-400">Min {t.minStaff} staff{t.minStaff > 1 ? '' : ''}</p>
                            </div>

                            {!t.isActive && (
                              <span className="mt-2 inline-block text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Inactive</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showSeasonModal && (
        <SeasonModal
          season={editingSeason}
          onClose={() => setShowSeasonModal(false)}
          onSaved={saved => {
            if (editingSeason) {
              setSeasons(prev => prev.map(s => s.id === saved.id ? saved : s));
              if (selectedSeason?.id === saved.id) setSelectedSeason(saved);
            } else {
              setSeasons(prev => [...prev, saved]);
            }
            setShowSeasonModal(false);
          }}
        />
      )}

      {showTemplateModal && selectedSeason && profile?.orgId && (
        <TemplateModal
          template={editingTemplate}
          seasonId={selectedSeason.id}
          orgId={profile.orgId}
          onClose={() => setShowTemplateModal(false)}
          onSaved={saved => {
            if (editingTemplate) {
              setTemplates(prev => prev.map(t => t.id === saved.id ? saved : t));
            } else {
              setTemplates(prev => [...prev, saved]);
            }
            setShowTemplateModal(false);
          }}
        />
      )}

      {showGenerateModal && selectedSeason && profile?.orgId && (
        <GenerateModal
          season={selectedSeason}
          templates={seasonTemplates}
          orgId={profile.orgId}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={count => {}}
        />
      )}
    </div>
    </AuthGuard>
  );
}
