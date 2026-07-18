'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }: ModalProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={cn('bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]', widths[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
export const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5';
