'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CopilotPanel } from '@/components/copilot/copilot-panel';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAppStore } from '@/store';
import { mockOrg } from '@/lib/mock-data';
import { Sparkles, Zap, BarChart3, Calendar, Users, ShieldCheck } from 'lucide-react';

const CAPABILITY_CARDS = [
  {
    icon: <Calendar className="h-5 w-5 text-indigo-600" />,
    title: 'Schedule Generation',
    desc: 'Generate complete schedules for any date range, department, or location in seconds.',
    examples: ["Generate next week's ICU schedule", 'Build a holiday schedule for all departments'],
  },
  {
    icon: <Users className="h-5 w-5 text-purple-600" />,
    title: 'Coverage & Staffing',
    desc: 'Find coverage for open shifts, identify gaps, and recommend qualified employees.',
    examples: ['Who can cover Friday night?', 'Find coverage for the ED — 3 callouts today'],
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-blue-600" />,
    title: 'Analytics & Reporting',
    desc: 'Get instant reports on labor costs, overtime, utilization, and compliance.',
    examples: ['Who is closest to overtime this week?', 'Show labor cost by department'],
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-green-600" />,
    title: 'Compliance & Rules',
    desc: 'Check certification status, flag labor law risks, and explain AI decisions.',
    examples: ['List employees with expiring certs', 'Why was Jordan assigned to Saturday?'],
  },
  {
    icon: <Zap className="h-5 w-5 text-amber-600" />,
    title: 'Bulk Actions',
    desc: 'Make sweeping changes to schedules through natural language commands.',
    examples: ['Swap Marcus and Priya on Thursday', 'Add a second nurse to all Friday day shifts'],
  },
  {
    icon: <Sparkles className="h-5 w-5 text-pink-600" />,
    title: 'AI Explanations',
    desc: 'Understand every AI assignment decision with full transparent reasoning.',
    examples: ['Explain the Monday schedule', 'Why is the ICU understaffed Thursday night?'],
  },
];

export default function CopilotPage() {
  const { setOrg } = useAppStore();
  useEffect(() => { setOrg(mockOrg); }, []);

  return (
    <AuthGuard>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          title="AI Copilot"
          subtitle="Conversational scheduling intelligence — powered by Claude"
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: capabilities overview */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Hero */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 mb-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">TimeSync AI Copilot</h1>
                  <p className="text-white/70 text-sm">Your intelligent scheduling assistant</p>
                </div>
              </div>
              <p className="text-white/90 text-sm leading-relaxed max-w-lg">
                Ask anything about your workforce in plain English. Generate schedules, find coverage,
                analyze labor costs, explain AI decisions, and make bulk edits — all through conversation.
              </p>
              <div className="flex items-center gap-4 mt-5 text-xs text-white/60">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400" />Connected to live schedule</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400" />12 employees in context</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400" />7 active rules loaded</span>
              </div>
            </div>

            {/* Capability cards */}
            <h2 className="text-sm font-semibold text-gray-700 mb-3">What Copilot can do</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {CAPABILITY_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{card.desc}</p>
                  <div className="space-y-1.5">
                    {card.examples.map((ex) => (
                      <div key={ex} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-300">›</span>
                        <span className="italic">"{ex}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent conversations */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent conversations</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {[
                  { title: 'Generate ICU schedule — Week of Jun 2', time: '2 hours ago', msgs: 6 },
                  { title: 'Find Friday ED coverage', time: 'Yesterday', msgs: 4 },
                  { title: 'Overtime analysis — May 26 week', time: '3 days ago', msgs: 3 },
                ].map((conv) => (
                  <div key={conv.title} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Sparkles size={12} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{conv.title}</p>
                        <p className="text-xs text-gray-400">{conv.msgs} messages · {conv.time}</p>
                      </div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: always-open copilot panel */}
          <CopilotPanel />
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
