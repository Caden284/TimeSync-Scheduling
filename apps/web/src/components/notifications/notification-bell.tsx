'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Bell, X, CalendarCheck, CalendarX, CalendarClock, Plane, CheckCircle2, XCircle, UserMinus, Repeat, HandHelping } from 'lucide-react';
import { supabase, fromRow } from '@/lib/supabase';
import { getNotifications, markNotificationsRead, dismissNotification } from '@/lib/db';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

interface Notification {
  id: string; type: string; title: string; body?: string | null; link?: string | null;
  readAt?: string | null; createdAt: string;
}

const ICONS: Record<string, React.ReactNode> = {
  schedule_published: <CalendarCheck size={14} className="text-indigo-500" />,
  shift_assigned:     <CalendarCheck size={14} className="text-green-500" />,
  shift_changed:      <CalendarClock size={14} className="text-amber-500" />,
  shift_removed:      <UserMinus size={14} className="text-amber-500" />,
  shift_cancelled:    <CalendarX size={14} className="text-red-500" />,
  time_off_requested: <Plane size={14} className="text-blue-500" />,
  time_off_approved:  <CheckCircle2 size={14} className="text-green-500" />,
  time_off_denied:    <XCircle size={14} className="text-red-500" />,
  shift_drop_requested: <Repeat size={14} className="text-blue-500" />,
  shift_drop_approved:  <CheckCircle2 size={14} className="text-green-500" />,
  shift_drop_denied:    <XCircle size={14} className="text-red-500" />,
  open_shift_claimed:   <HandHelping size={14} className="text-green-500" />,
};

// Bell with a live list of the signed-in user's notifications. Rows are
// created by database triggers (shift assigned/changed, schedule published,
// time off requested/decided) and arrive over Supabase Realtime.
export function NotificationBell({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!user) return;
    getNotifications().then(rows => setItems(rows as Notification[])).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        payload => setItems(prev => [fromRow<Notification>(payload.new), ...prev.filter(n => n.id !== payload.new.id)]))
      .subscribe();
    // Fallback in case the live connection drops.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const timer = setInterval(load, 120_000);
    return () => { supabase.removeChannel(channel); window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [user?.id, load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter(n => !n.readAt);

  async function markAllRead() {
    const ids = unread.map(n => n.id);
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.readAt ? n : { ...n, readAt: now })));
    await markNotificationsRead(ids).catch(load);
  }

  async function openItem(n: Notification) {
    if (!n.readAt) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      markNotificationsRead([n.id]).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function dismiss(id: string) {
    setItems(prev => prev.filter(n => n.id !== id));
    await dismissNotification(id).catch(load);
  }

  const dark = tone === 'dark';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn('relative p-2 rounded-lg transition-colors',
          dark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
          open && (dark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'))}
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={20} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">You&apos;re all caught up</p>
              </div>
            ) : items.map(n => (
              <div key={n.id} className={cn('group flex items-start gap-3 px-4 py-3 hover:bg-gray-50', !n.readAt && 'bg-indigo-50/40')}>
                <div className="mt-0.5 shrink-0">{ICONS[n.type] ?? <Bell size={14} className="text-gray-400" />}</div>
                <button onClick={() => openItem(n)} className="flex-1 min-w-0 text-left">
                  <p className={cn('text-xs text-gray-900', !n.readAt ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-600 mt-0.5 leading-snug">{n.body}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </button>
                <button onClick={() => dismiss(n.id)} aria-label="Dismiss notification"
                  className="shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
