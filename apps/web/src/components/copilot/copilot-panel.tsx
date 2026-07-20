'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, useCopilotStore, useRulesStore } from '@/store';
import { useAuth } from '@/context/auth-context';
import { getEmployees, getShifts } from '@/lib/db';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import type { CopilotMessage } from '@/types';

const SUGGESTED_PROMPTS = [
  'Generate next week\'s schedule',
  'Who is closest to overtime this week?',
  'Find coverage for an open shift',
  'Summarize my active scheduling rules',
  'What shifts are open this week?',
  'Help me balance weekend shifts fairly',
  'Show labor cost breakdown by department',
  'What employees can work tomorrow?',
];

export function CopilotPanel() {
  const { toggleCopilot, org, cachedShifts } = useAppStore();
  const { rules } = useRulesStore();
  const { profile } = useAuth();
  const { conversations, activeConversationId, isStreaming, createConversation, addMessage, appendStreamChunk, finishStreaming, setStreaming } = useCopilotStore();
  const [input, setInput] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const conversation = conversations.find(c => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];

  // Load employees for context (once)
  useEffect(() => {
    if (profile?.orgId) {
      getEmployees(profile.orgId).then(setEmployees).catch(() => {});
    }
  }, [profile?.orgId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text?: string) {
    const content = text ?? input.trim();
    if (!content || isStreaming) return;
    setInput('');
    setApiError(null);

    const convId = activeConversationId ?? `conv-${Date.now()}`;
    if (!activeConversationId) {
      createConversation({ id: convId, title: content.slice(0, 60), messages: [], createdAt: new Date().toISOString() });
    }

    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    addMessage(convId, userMsg);

    setStreaming(true);
    const aiMsgId = `msg-ai-${Date.now()}`;
    addMessage(convId, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true });

    // Build full conversation history for Claude
    const conv = useCopilotStore.getState().conversations.find(c => c.id === convId);
    const history = (conv?.messages ?? [])
      .filter(m => !m.isStreaming && m.id !== aiMsgId)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Employee context
    const empContext = employees.map(e => ({
      name: `${e.firstName} ${e.lastName}`,
      role: e.role ?? e.primaryRole?.name,
      department: e.departmentName ?? e.primaryDept?.name,
      employmentType: e.employmentType,
      payRate: e.payRate ? parseFloat(e.payRate).toFixed(2) : undefined,
    }));

    // Shift context (current week's cached shifts)
    const shiftContext = cachedShifts.map(s => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.title,
      department: s.department?.name,
      status: s.isOpen ? 'Open' : 'Filled',
    }));

    // Rule context
    const ruleContext = rules.map(r => ({
      name: r.name,
      description: r.description ?? '',
      constraintType: r.constraintType,
      priority: r.priority,
      weight: r.weight,
      ruleType: r.ruleType,
      parameters: r.parameters as Record<string, unknown>,
      isEnabled: r.isEnabled,
    }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: history,
          rules: ruleContext,
          employees: empContext,
          shifts: shiftContext,
          orgName: org?.name ?? profile?.orgId ?? 'Your Organization',
          currentDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) appendStreamChunk(convId, aiMsgId, parsed.text);
          } catch (e: any) {
            if (e.message !== 'Unexpected end of JSON input') throw e;
          }
        }
      }

      finishStreaming(convId, aiMsgId);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        finishStreaming(convId, aiMsgId);
        return;
      }
      finishStreaming(convId, aiMsgId);
      setApiError(err?.message ?? 'AI request failed');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <aside className="flex flex-col w-96 bg-white border-l border-gray-200 h-full shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white leading-none">AI Copilot</p>
          <p className="text-[10px] text-white/70 mt-0.5">
            Powered by Claude · {rules.filter(r => r.isEnabled).length} active rule{rules.filter(r => r.isEnabled).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={toggleCopilot} className="p-1 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* API error banner */}
      {apiError && (
        <div className="mx-3 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 leading-snug">
            {apiError.includes('ANTHROPIC_API_KEY')
              ? 'Add ANTHROPIC_API_KEY to .env.local to enable real AI responses.'
              : apiError}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-3">
                <Sparkles size={22} className="text-indigo-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">TimeSync Copilot</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Ask me to generate schedules, find coverage, explain rule conflicts, or analyze labor costs.
              </p>
              <p className="text-[10px] text-indigo-600 mt-1.5 font-medium">
                Knows your {employees.length} employees, {cachedShifts.length} shifts, and {rules.filter(r=>r.isEnabled).length} active rules
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Try asking…</p>
              <div className="space-y-1.5">
                {SUGGESTED_PROMPTS.slice(0, 5).map(prompt => (
                  <button key={prompt} onClick={() => handleSend(prompt)}
                    className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 shrink-0">
        {messages.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.slice(5).map(p => (
              <button key={p} onClick={() => handleSend(p)}
                className="whitespace-nowrap rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                {p.slice(0, 32)}…
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your schedule…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none max-h-32 leading-relaxed"
            style={{ minHeight: '20px' }}
          />
          {isStreaming ? (
            <button onClick={handleStop}
              className="h-7 w-7 rounded-lg flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-200 transition-all shrink-0">
              <RefreshCw size={12} className="animate-spin" />
            </button>
          ) : (
            <button onClick={() => handleSend()} disabled={!input.trim()}
              className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0',
                input.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed')}>
              <Send size={12} />
            </button>
          )}
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5 text-center">
          AI may make mistakes. Always verify scheduling decisions.
        </p>
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === 'user';

  // Render markdown-lite: bold, line breaks, bullet lists
  function renderContent(text: string) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold: **text**
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
      // Bullet
      const isBullet = line.match(/^[-•*]\s/);
      const isNumbered = line.match(/^\d+\.\s/);
      return (
        <span key={i} className={cn('block', (isBullet || isNumbered) && 'pl-2', i > 0 && !isBullet && !isNumbered && line === '' && 'mt-1')}>
          {rendered}
        </span>
      );
    });
  }

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
        isUser ? 'bg-indigo-100 text-indigo-700' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white')}>
        {isUser ? (message.content[0]?.toUpperCase() ?? 'U') : <Sparkles size={12} />}
      </div>

      <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        isUser ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm')}>
        {message.content ? (
          isUser ? message.content : <div className="space-y-0.5 text-xs">{renderContent(message.content)}</div>
        ) : (message.isStreaming && (
          <div className="flex gap-1 items-center py-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        ))}
        {message.isStreaming && message.content && (
          <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
