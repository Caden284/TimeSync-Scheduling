'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore, useRulesStore } from '@/store';
import { mockRules } from '@/lib/mock-data';
import { useAuth } from '@/context/auth-context';
import { getRules, createRule, toggleRule as dbToggleRule, deleteRule as dbDeleteRule } from '@/lib/db';
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

// Default system rules seeded the first time an org has no rules in Appwrite
const SYSTEM_DEFAULTS = mockRules.filter(r =>
  ['MAX_HOURS_WEEK', 'MIN_REST_BETWEEN', 'PREFER_AVAILABILITY', 'BALANCE_WEEKENDS', 'MINIMIZE_OVERTIME'].includes(r.ruleType)
);

export default function RulesPage() {
  const { copilotOpen, addToast } = useAppStore();
  const { profile } = useAuth();
  const { rules, setOrgRules, addRule: storeAddRule, toggleRule: storeToggle, deleteRule: storeDelete, updateRule: storeUpdate } = useRulesStore();
  const [selected, setSelected] = useState<SchedulingRule | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load rules from Appwrite on mount
  useEffect(() => {
    if (!profile?.orgId) return;
    setLoading(true);
    getRules(profile.orgId)
      .then(async (fetched) => {
        if (fetched.length === 0) {
          // First-time: seed universal defaults into Appwrite
          const seeded: SchedulingRule[] = [];
          for (const r of SYSTEM_DEFAULTS) {
            try {
              const saved = await createRule(profile.orgId, {
                name: r.name, ruleType: r.ruleType, constraintType: r.constraintType,
                description: r.description, isEnabled: r.isEnabled, isSystem: r.isSystem ?? false,
                priority: r.priority, weight: r.weight,
                parameters: r.parameters as Record<string, unknown>,
              });
              seeded.push(saved as unknown as SchedulingRule);
            } catch {}
          }
          setOrgRules(profile.orgId, seeded);
        } else {
          setOrgRules(profile.orgId, fetched as unknown as SchedulingRule[]);
        }
      })
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
    if (!rule || !confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
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
                description="These rules cannot be violated — the AI will never generate a schedule that breaks them."
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
                description="The AI will try to satisfy these rules but may trade them off when necessary. Each has a configurable weight."
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
                  <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <Section title="Configuration">
                  <InfoRow label="Type" value={selected.ruleType} />
                  <InfoRow label="Category" value={selected.constraintType === 'hard' ? '🔴 Hard constraint' : '🟡 Soft constraint'} />
                  <InfoRow label="Priority" value={String(selected.priority)} />
                  {selected.weight !== undefined && (
                    <div>
                      <InfoRow label="Weight" value={`${(selected.weight * 100).toFixed(0)}%`} />
                      <div className="h-1.5 rounded-full bg-gray-100 mt-1">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(selected.weight ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Section>

                <Section title="Scope">
                  <InfoRow label="Departments" value={selected.scopeDepts?.length ? `${selected.scopeDepts.length} dept(s)` : 'All departments'} />
                  <InfoRow label="Locations" value={selected.scopeLocations?.length ? `${selected.scopeLocations.length} location(s)` : 'All locations'} />
                  <InfoRow label="Roles" value={selected.scopeRoles?.length ? `${selected.scopeRoles.length} role(s)` : 'All roles'} />
                </Section>

                {Object.keys(selected.parameters).length > 0 && (
                  <Section title="Parameters">
                    {Object.entries(selected.parameters).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                    ))}
                  </Section>
                )}

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
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{rule.description}</p>
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
