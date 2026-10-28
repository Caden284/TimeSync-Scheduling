'use client';

import { Menu, Sparkles } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { toggleCopilot, copilotOpen, mobileNavOpen, setMobileNavOpen } = useAppStore();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 sm:gap-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-3 sm:px-6">
      <button onClick={() => setMobileNavOpen(true)} aria-label="Open menu" aria-controls="app-sidebar" aria-expanded={mobileNavOpen}
        className="md:hidden -ml-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900">
        <Menu size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>

      <Button
        variant="ai"
        size="sm"
        onClick={toggleCopilot}
        className={cn(copilotOpen && 'ring-2 ring-purple-400 ring-offset-1')}
        leftIcon={<Sparkles size={14} />}
        aria-label="AI Copilot"
        aria-pressed={copilotOpen}
      >
        <span className="hidden sm:inline">Copilot</span>
      </Button>

      <NotificationBell />

      {/* On phones, action buttons shrink to their icons (labels stay for screen readers). */}
      {actions && <div className="flex items-center gap-2 [&_button]:shrink-0 max-sm:[&_button]:text-[0px] max-sm:[&_button]:gap-0">{actions}</div>}
    </header>
  );
}
