'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Search, Sparkles, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const NOTIFICATIONS = [
  { id: '1', type: 'info',    icon: <Clock size={14} className="text-blue-500" />,    title: 'Schedule Published',   body: 'Week of Jul 19 is now visible to staff.',  time: '2m ago',  read: false },
  { id: '2', type: 'warn',    icon: <AlertCircle size={14} className="text-amber-500" />, title: 'Open Shift Alert',  body: 'ED Open Shift on Mon has no assignee.',     time: '15m ago', read: false },
  { id: '3', type: 'success', icon: <CheckCircle2 size={14} className="text-green-500" />, title: 'Time-Off Approved', body: 'Jordan S. time-off request was approved.', time: '1h ago',  read: true  },
  { id: '4', type: 'info',    icon: <Clock size={14} className="text-blue-500" />,    title: 'New Employee Added',   body: 'Casey W. has been added to the roster.',   time: '3h ago',  read: true  },
];

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { toggleCopilot, copilotOpen, setCommandPaletteOpen } = useAppStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>

      {/* Search */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 hover:bg-white transition-colors w-56"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-200">⌘K</kbd>
      </button>

      {/* AI Copilot */}
      <Button
        variant="ai"
        size="sm"
        onClick={toggleCopilot}
        className={cn(copilotOpen && 'ring-2 ring-purple-400 ring-offset-1')}
        leftIcon={<Sparkles size={14} />}
      >
        Copilot
      </Button>

      {/* Notifications */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          className={cn(
            'relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors',
            notifOpen && 'bg-gray-100 text-gray-900'
          )}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                      !n.read && 'bg-indigo-50/40'
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold text-gray-900', !n.read && 'font-bold')}>{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{n.time}</p>
                    </div>
                    <button onClick={() => dismiss(n.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
              <button
                onClick={() => setNotifOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700 w-full text-center"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
