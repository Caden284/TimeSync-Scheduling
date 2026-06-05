'use client';

import { X, Clock, MapPin, Users, Star, AlertCircle, CheckCircle2, Sparkles, User } from 'lucide-react';
import type { Shift, ShiftAssignment } from '@/types';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatShiftTime, formatHours, getContrastColor } from '@/lib/utils';

interface ShiftDetailPanelProps {
  shift: Shift;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShiftDetailPanel({ shift, onClose, onEdit, onDelete }: ShiftDetailPanelProps) {
  const color = shift.color ?? '#6366f1';
  const coverage = shift.assignments.length / shift.minStaff;

  return (
    <aside className="flex flex-col w-80 bg-white border-l border-gray-200 h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between px-4 py-4 border-b border-gray-100"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {shift.department?.name ?? 'Shift'}
            </p>
          </div>
          <h2 className="text-base font-bold text-gray-900 truncate">
            {shift.title ?? shift.role?.name ?? 'Shift'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Shift Info */}
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <InfoRow icon={<Clock size={14} className="text-gray-400" />} label="Time">
            <span className="text-sm font-medium text-gray-900">
              {formatShiftTime(shift.startTime, shift.endTime)}
            </span>
            <span className="text-xs text-gray-500 ml-1">({formatHours(shift.durationHours)})</span>
          </InfoRow>

          {shift.location && (
            <InfoRow icon={<MapPin size={14} className="text-gray-400" />} label="Location">
              <span className="text-sm text-gray-900">{shift.location.name}</span>
            </InfoRow>
          )}

          <InfoRow icon={<Users size={14} className="text-gray-400" />} label="Staffing">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full bg-gray-100 h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, coverage * 100)}%`,
                    backgroundColor: coverage >= 1 ? '#22c55e' : coverage >= 0.5 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">
                {shift.assignments.length}/{shift.minStaff}
              </span>
            </div>
          </InfoRow>

          <div className="flex gap-2">
            <Badge variant={shift.isOpen ? 'warning' : 'success'}>
              {shift.isOpen ? 'Open' : 'Scheduled'}
            </Badge>
            <Badge variant="default">{shift.shiftType}</Badge>
            {shift.crossesMidnight && <Badge variant="purple">Overnight</Badge>}
          </div>
        </div>

        {/* Assigned Employees */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Assigned Employees
          </h3>
          {shift.assignments.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <AlertCircle size={20} className="text-amber-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">Unfilled shift</p>
              <p className="text-xs text-gray-500 mt-0.5">No employees assigned yet</p>
              <Button variant="primary" size="sm" className="mt-3">
                Find Coverage
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {shift.assignments.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </div>

        {/* AI Explanation */}
        {shift.assignments[0]?.aiExplanation && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={13} className="text-indigo-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI Assignment Reasoning</h3>
            </div>
            <div className="space-y-2">
              {shift.assignments[0].aiExplanation.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={cn(
                    'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0',
                    reason.weight === 'HARD' ? 'bg-red-100' : 'bg-green-100'
                  )}>
                    {reason.weight === 'HARD'
                      ? <AlertCircle size={9} className="text-red-600" />
                      : <CheckCircle2 size={9} className="text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{reason.factor}</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed">{reason.detail}</p>
                  </div>
                  {typeof reason.score === 'number' && (
                    <span className="text-[10px] font-mono text-gray-400">{(reason.score * 100).toFixed(0)}%</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">Overall AI Score</p>
              <span className="text-xs font-bold text-indigo-600">
                {((shift.assignments[0].aiExplanation.overallScore ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        {shift.notes && (
          <div className="px-4 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Notes</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{shift.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onEdit}>
          Edit Shift
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </aside>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="flex items-center gap-1.5 flex-1">
        {children}
      </div>
    </div>
  );
}

function AssignmentRow({ assignment }: { assignment: ShiftAssignment }) {
  if (!assignment.employee) return null;
  const emp = assignment.employee;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar
        firstName={emp.firstName}
        lastName={emp.lastName}
        color={emp.displayColor}
        src={emp.avatarUrl}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {emp.firstName} {emp.lastName}
        </p>
        <p className="text-[10px] text-gray-500">
          {assignment.assignedBy === 'ai' ? '✨ AI assigned' : 'Manually assigned'}
        </p>
      </div>
      <Badge
        variant={assignment.status === 'confirmed' ? 'success' : assignment.status === 'declined' ? 'danger' : 'default'}
        className="text-[10px]"
      >
        {assignment.status}
      </Badge>
    </div>
  );
}
