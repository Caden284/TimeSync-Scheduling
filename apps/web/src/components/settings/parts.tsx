'use client';

// Layout pieces shared by the Settings sections.

export const COLORS = ['#6366f1', '#ef4444', '#f97316', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

export function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-gray-200 pb-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
