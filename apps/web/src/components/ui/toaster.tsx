'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

const ICONS = {
  success: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
  error:   <XCircle     size={16} className="text-red-500   flex-shrink-0" />,
  info:    <Info        size={16} className="text-blue-500  flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
};

const BORDERS = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  info:    'border-l-blue-500',
  warning: 'border-l-amber-500',
};

function ToastItem({ id, type, title, message }: { id: string; type: 'success'|'error'|'info'|'warning'; title: string; message?: string }) {
  const removeToast = useAppStore(s => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), type === 'error' ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [id, type, removeToast]);

  return (
    <div className={cn(
      'flex items-start gap-3 bg-white rounded-xl border border-gray-200 border-l-4 shadow-lg px-4 py-3 w-80 animate-in slide-in-from-right-4 duration-200',
      BORDERS[type]
    )}>
      {ICONS[type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {message && <p className="text-xs text-gray-500 mt-0.5">{message}</p>}
      </div>
      <button onClick={() => removeToast(id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
        <X size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useAppStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
