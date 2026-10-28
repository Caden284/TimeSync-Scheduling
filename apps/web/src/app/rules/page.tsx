'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAppStore, useRulesStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { useOrgData } from '@/lib/org-data';
import { getRules, createRule, updateRule as dbUpdateRule, toggleRule as dbToggleRule, deleteRule as dbDeleteRule } from '@/lib/db';
import { RULE_PARAMS, isRuleEnforced, ruleValue } from '@/lib/rule-engine';
import { cn } from '@/lib/utils';
import { Plus, ShieldCheck, ShieldAlert, ToggleLeft, ToggleRight, Zap, ChevronRight, Loader2 } from 'lucide-react';
import type { SchedulingRule } from '@/types';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { NewRuleModal } from '@/components/rules/new-rule-modal';

const RULE_TYPE_ICONS: Record<string, string> = {
  MIN_STAFFING: '👥', MAX_STAFFING: '🔢', REQUIRE_SKILL: '⭐', REQUIRE_CERT: '🏅',
  MAX_HOURS_DAY: '⏰', MAX_HOURS_WEEK: '📅', MIN_REST_BETWEEN: '🌙',
  MAX_CONSECUTIVE_DAYS: '📆', BREAK_REQUIREMENT: '☕', NO_OVERTIME_UNAUTH: '⚠️',
  CERT_REQUIRED: '🛡️', MINOR_RESTRICTIONS: '🔒',
  PREFER_AVAILABILITY: '✅', PREFER_DAYS: '📅', BALANCE_HOURS: '⚖️',
  BALANCE_WEEKENDS: '☀️', MINIMIZE_OVERTIME: '📉', MINIMIZE_COST: '💰',
  SENIORITY_ORDER: '🏆', SKILL_MATCH_QUALITY: '🎯',
};

export default function RulesPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const { departments, workerTypes } = useOrgData();
  const { rules, setOrgRules, addRule: storeAddRule, toggleRule: storeToggle, deleteRule: storeDelete, updateRule: storeUpdate } = useRulesStore();
  const [selected, setSelected] = useState<SchedulingRule | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load rules from Supabase on mount
  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    // New organizations get default rules from the database when they're created.
    getRules(profile.orgId)
      .then(fetched => setOrgRules(profile.orgId, fetched as unknown as SchedulingRule[]))
      .catch(() => addToast({ type: 'error', title: 'Failed to load rules' }))
      .finally(() => setLoading(false));
  }, [profile?.orgId]);

  async function toggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    setToggling(id);
    const newVal = !rule.isEnabled;
    storeToggle(id);
    setSelected(prev => prev?.id === id ? { ...prev, isEnabled: newVal } : prev);
    try {
      await dbToggleRule(id, newVal);
    } catch {
      // Revert on failure
      storeToggle(id);
      addToast({ type: 'error', title: 'Failed to update rule' });
    } finally {
      setToggling(null);
    }
  }

  async function deleteRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule || !(await confirmDialog({ title: `Delete "${rule.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    setDeleting(id);
    storeDelete(id);
    if (selected?.id === id) setSelected(null);
    try {
      await dbDeleteRule(id);
      addToast({ type: 'success', title: 'Rule deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete rule' });
    } finally {
      setDeleting(null);
    }
  }

  async function handleRuleSaved(rule: SchedulingRule) {
    if (!profile?.orgId) return;
    try {
      const saved = await createRule(profile.orgId, {
        name: rule.name, ruleType: rule.ruleType, constraintType: rule.constraintType,
        description: rule.description, isEnabled: true, isSystem: false,
        priority: rule.priority, weight: rule.weight,
        parameters: rule.parameters as Record<string, unknown>,
        scopeDepts: rule.scopeDepts,
        scopeWorkerTypes: rule.scopeWorkerTypes,
      });
      storeAddRule(saved as unknown as SchedulingRule);
      addToast({ type: 'success', title: 'Rule created', message: rule.name });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to save rule', message: e?.message });
    }
  }

  const hardRules = rules.filter(r => r.constraintType === 'hard');
  const softRules = rules.filter(r => r.constraintType === 'soft');

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="Rule Engine"
          subtitle={`${rules.filter(r => r.isEnabled).length} active rules · ${rules.filter(r=>r.constraintType==='hard').length} hard, ${rules.filter(r=>r.constraintType==='soft').length} soft`}
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} className="text-xs"
              onClick={() => setShowNewModal(true)}>
              New Rule
            </Button>
          }
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading rules…</span>
              </div>
            ) : (
            <div className="p-6 space-y-6">

              {/* Hard Constraints */}
              <RuleGroup
                title="Hard Constraints"
                description="Assignments that break these are blocked — in the Assign picker, Auto-Schedule, and the AI Copilot."
                icon={<ShieldAlert size={16} className="text-red-500" />}
                badgeVariant="danger"
                rules={hardRules}
                selected={selected}
                onSelect={setSelected}
                onToggle={toggleRule}
                toggling={toggling}
              />

              {/* Soft Constraints */}
              <RuleGroup
                title="Soft Constraints"
                description="Assignments that break these show a warning. Auto-Schedule avoids them whenever someone else is free."
                icon={<ShieldCheck size={16} className="text-indigo-500" />}
                badgeVariant="primary"
                rules={softRules}
                selected={selected}
                onSelect={setSelected}
                onToggle={toggleRule}
                toggling={toggling}
              />

            </div>
            )}
          </div>

          {/* Rule detail panel */}
          {selected && !copilotOpen && (
            <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl mb-2">{RULE_TYPE_ICONS[selected.ruleType] ?? '⚙️'}</p>
                    <h2 className="text-base font-bold text-gray-900">{selected.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">{selected.description}</p>
                  </div>
                  <button onClick={() => setSelected(null)} aria-label="Close rule details" className="p-1 text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <RuleSettings rule={selected} onSaved={updated => {
                  storeUpdate(selected.id, updated);
                  setSelected(prev => (prev ? { ...prev, ...updated } : prev));
                }} />

                <Section title="Scope">
                  <InfoRow label="People" value={selected.scopeWorkerTypes?.length
                    ? selected.scopeWorkerTypes.map(id => workerTypes.find(w => w.id === id)?.name ?? 'Unknown').join(', ')
                    : 'Everyone'} />
                  <InfoRow label="Departments" value={selected.scopeDepts?.length
                    ? selected.scopeDepts.map(id => departments.find(d => d.id === id)?.name ?? 'Unknown').join(', ')
                    : 'All departments'} />
                </Section>

                <Section title="Status">
                  <InfoRow label="Enabled" value={selected.isEnabled ? '✅ Active' : '⏸ Disabled'} />
                  <InfoRow label="System rule" value={selected.isSystem ? 'Yes (cannot delete)' : 'No'} />
                  <InfoRow label="Created" value={new Date(selected.createdAt).toLocaleDateString()} />
                </Section>

                <div className="flex gap-2 pt-2">
                  <Button variant="primary" size="sm" className="flex-1"
                    loading={toggling === selected.id}
                    onClick={() => toggleRule(selected.id)}>
                    {selected.isEnabled ? 'Disable Rule' : 'Enable Rule'}
                  </Button>
                  {!selected.isSystem && (
                    <Button variant="danger" size="sm"
                      loading={deleting === selected.id}
                      onClick={() => deleteRule(selected.id)}>Delete</Button>
                  )}
                </div>
              </div>
            </aside>
          )}

          {copilotOpen && <CopilotPanel />}
        </div>
      </div>

      {showNewModal && (
        <NewRuleModal onClose={() => setShowNewModal(false)}
          onSaved={rule => handleRuleSaved(rule as SchedulingRule)} />
      )}
    </div>
    </AuthGuard>
  );
}

function RuleGroup({
  title, description, icon, badgeVariant, rules, selected, onSelect, onToggle, toggling,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeVariant: 'danger' | 'primary';
  rules: SchedulingRule[];
  selected: SchedulingRule | null;
  onSelect: (r: SchedulingRule) => void;
  onToggle: (id: string) => void;
  toggling: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        {icon}
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <Badge variant={badgeVariant}>{rules.length}</Badge>
        <p className="text-xs text-gray-500 ml-1">{description}</p>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            onClick={() => onSelect(rule)}
            className={cn(
              'flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 cursor-pointer transition-all',
              selected?.id === rule.id
                ? 'border-indigo-300 ring-1 ring-indigo-300 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
              !rule.isEnabled && 'opacity-50'
            )}
          >
            <span className="text-xl flex-shrink-0">{RULE_TYPE_ICONS[rule.ruleType] ?? '⚙️'}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{rule.name}</p>
                {rule.isSystem && (
                  <Badge variant="default" className="text-[9px]">System</Badge>
                )}
                {!isRuleEnforced(rule.ruleType) && (
                  <Badge variant="warning" className="text-[9px]">Not checked</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {RULE_PARAMS[rule.ruleType] && <span className="font-medium text-gray-700">{ruleValue(rule)} {RULE_PARAMS[rule.ruleType].unit} · </span>}
                {rule.description}
              </p>
            </div>

            {rule.weight !== undefined && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(rule.weight) * 100}%` }} />
                </div>
                <span className="font-mono">{(rule.weight * 100).toFixed(0)}%</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="default" className="text-[9px] hidden sm:inline-flex">
                P{rule.priority}
              </Badge>
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(rule.id); }}
                disabled={toggling === rule.id}
                aria-label={rule.isEnabled ? `Disable ${rule.name}` : `Enable ${rule.name}`}
                aria-pressed={rule.isEnabled}
                className={cn(
                  'transition-colors',
                  toggling === rule.id ? 'text-gray-300' : rule.isEnabled ? 'text-indigo-600' : 'text-gray-300'
                )}
              >
                {toggling === rule.id
                  ? <Loader2 size={18} className="animate-spin" />
                  : rule.isEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <ChevronRight size={14} className="text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500 capitalize">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// Threshold and hard/soft switch for the selected rule.
function RuleSettings({ rule, onSaved }: { rule: SchedulingRule; onSaved: (patch: Partial<SchedulingRule>) => void }) {
  const { addToast } = useAppStore();
  const meta = RULE_PARAMS[rule.ruleType];
  const [value, setValue] = useState(String(ruleValue(rule)));
  const [constraintType, setConstraintType] = useState(rule.constraintType);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(String(ruleValue(rule))); setConstraintType(rule.constraintType); }, [rule.id]);

  const dirty = constraintType !== rule.constraintType || (meta && Number(value) !== ruleValue(rule));

  async function save() {
    const n = Number(value);
    if (meta && (!Number.isFinite(n) || n <= 0)) { addToast({ type: 'error', title: `${meta.label} must be a positive number` }); return; }
    setSaving(true);
    try {
      const parameters = meta ? { ...rule.parameters, [meta.key]: n } : rule.parameters;
      if (meta) delete (parameters as Record<string, unknown>).value;
      await dbUpdateRule(rule.id, { constraintType, parameters: parameters as Record<string, unknown> });
      onSaved({ constraintType, parameters });
      addToast({ type: 'success', title: 'Rule updated' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Could not update rule', message: e?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Settings">
      {!isRuleEnforced(rule.ruleType) && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
          TimeSync doesn&apos;t track the data this rule needs (skills, certifications, or breaks), so it isn&apos;t checked yet.
        </p>
      )}
      {meta && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{meta.label}</label>
          <div className="flex items-center gap-2">
            <input type="number" min="1" value={value} onChange={e => setValue(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-xs text-gray-500">{meta.unit}</span>
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-500 mb-1">When broken</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['hard', 'soft'] as const).map(t => (
            <button key={t} onClick={() => setConstraintType(t)}
              className={cn('rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                constraintType === t
                  ? t === 'hard' ? 'border-red-300 bg-red-50 text-red-700' : 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
              {t === 'hard' ? 'Block' : 'Warn'}
            </button>
          ))}
        </div>
      </div>
      {dirty && <Button variant="primary" size="sm" className="w-full" onClick={save} loading={saving}>Save changes</Button>}
    </Section>
  );
}
