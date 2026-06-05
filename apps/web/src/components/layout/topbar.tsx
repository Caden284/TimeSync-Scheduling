'use client';

import { Bell, Search, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { toggleCopilot, copilotOpen, setCommandPaletteOpen } = useAppStore();

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
      <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
      </button>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
