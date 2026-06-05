'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RefreshCw, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore, useCopilotStore } from '@/store';
import type { CopilotMessage } from '@/types';

const SUGGESTED_PROMPTS = [
  'Generate next week\'s schedule for the ICU',
  'Find coverage for Friday — someone called out',
  'Who is closest to overtime this week?',
  'Why did you assign Sarah to the night shift?',
  'Show me employees with expiring certifications',
  'Reduce overtime by $500 this week',
  'Who can cover an ED shift Saturday morning?',
  'Balance weekend shifts across the team',
];

export function CopilotPanel() {
  const { toggleCopilot } = useAppStore();
  const { conversations, activeConversationId, isStreaming, createConversation, addMessage, setStreaming } = useCopilotStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(text?: string) {
    const content = text ?? input.trim();
    if (!content || isStreaming) return;
    setInput('');

    const convId = activeConversationId ?? `conv-${Date.now()}`;

    if (!activeConversationId) {
      createConversation({
        id: convId,
        title: content.slice(0, 60),
        messages: [],
        createdAt: new Date().toISOString(),
      });
    }

    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    addMessage(convId, userMsg);

    // Simulate AI streaming response
    setStreaming(true);
    const aiMsgId = `msg-ai-${Date.now()}`;
    const aiMsg: CopilotMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    addMessage(convId, aiMsg);

    simulateStream(convId, aiMsgId, content);
  }

  function simulateStream(convId: string, msgId: string, userQuery: string) {
    const { appendStreamChunk, finishStreaming } = useCopilotStore.getState();
    const response = getMockResponse(userQuery);
    let i = 0;
    const interval = setInterval(() => {
      if (i >= response.length) {
        clearInterval(interval);
        finishStreaming(convId, msgId);
        return;
      }
      const chunk = response.slice(i, i + 4);
      appendStreamChunk(convId, msgId, chunk);
      i += 4;
    }, 20);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
          <p className="text-[10px] text-white/70 mt-0.5">Powered by Claude</p>
        </div>
        <button
          onClick={toggleCopilot}
          className="p-1 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="text-center py-4">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-3">
                <Sparkles size={22} className="text-indigo-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">TimeSync Copilot</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Ask me to generate schedules, find coverage, explain AI decisions, or run analytics.
              </p>
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Try asking…</p>
              <div className="space-y-1.5">
                {SUGGESTED_PROMPTS.slice(0, 5).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 shrink-0">
        {messages.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.slice(5).map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                {p.slice(0, 30)}…
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your schedule…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none max-h-32 leading-relaxed"
            style={{ minHeight: '20px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0',
              input.trim() && !isStreaming
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isStreaming
              ? <RefreshCw size={12} className="animate-spin" />
              : <Send size={12} />}
          </button>
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

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
        isUser ? 'bg-indigo-100 text-indigo-700' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
      )}>
        {isUser ? 'M' : <Sparkles size={12} />}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-900 rounded-tl-sm'
      )}>
        {message.content || (message.isStreaming && (
          <div className="flex gap-1 items-center py-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        ))}
        {message.isStreaming && message.content && (
          <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function getMockResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('generate') || q.includes('schedule')) {
    return `I'll generate the ICU schedule for next week. Here's my plan:\n\n**Analysis complete:**\n- 12 employees eligible for ICU shifts\n- 21 required shift slots across Mon–Sun\n- 3 employees with preferred time-off this week\n\n**Running optimization...**\n\nSchedule generated ✅\n\n**Summary:**\n- 21/21 shifts filled (100% coverage)\n- Total labor cost: $38,420\n- 0 overtime violations\n- Avg preference score: 91%\n\nI honored Sarah's Monday preference, balanced weekends evenly, and kept Marcus on day shifts as requested. Would you like to review the schedule or publish it?`;
  }
  if (q.includes('overtime')) {
    return `📊 **Overtime Report — Current Week**\n\nEmployees approaching overtime (>36h scheduled):\n\n1. **Marcus Williams** — 38.5h (↑ 2.5h over target)\n2. **Priya Patel** — 37.0h (↑ 1.0h over target)\n3. **Morgan Davis** — 36.5h (↑ 0.5h over target)\n\nTo reduce overtime by ~$500, I recommend:\n- Swap Marcus's Friday shift to Jordan Smith (24.5h this week, prefers more hours)\n- This saves ~$84 in premium pay\n\nWant me to make this swap automatically?`;
  }
  if (q.includes('coverage') || q.includes('friday')) {
    return `Looking for Friday coverage...\n\n**Available & qualified employees:**\n\n✅ **Casey Wilson** (per diem)\n- Available Friday, 7am–7pm\n- BLS/ACLS certified\n- Worked 12h this week (below max)\n- Cost: $48/hr\n\n✅ **Jamie Anderson** (part-time)\n- Available Friday afternoon\n- All certifications current\n- Cost: $41.50/hr\n\nRecommendation: **Casey Wilson** — best availability match, minimal overtime risk.\n\nShall I assign Casey to the Friday day shift?`;
  }
  if (q.includes('certif')) {
    return `🔔 **Certification Expiry Report**\n\nThe following certifications expire in the next 30 days:\n\n⚠️ **Alex Johnson** — BLS expires Jun 15 (10 days)\n⚠️ **Taylor Brown** — ACLS expires Jun 22 (17 days)\n⚠️ **Riley Martinez** — TNCC expires Jun 28 (23 days)\n\n**Action required:** These employees cannot be scheduled for shifts requiring these certifications after expiry.\n\nWould you like me to send renewal reminders to these employees?`;
  }
  return `I understand you're asking about "${query}". Let me analyze the current schedule and employee data...\n\nBased on the current schedule for Metro General Hospital, here's what I found:\n\n- Total employees scheduled this week: 12\n- Coverage rate: 94.2%\n- Open shifts remaining: 3\n\nWhat specific action would you like me to take? I can generate schedules, find coverage, analyze costs, or explain any assignment decision.`;
}
