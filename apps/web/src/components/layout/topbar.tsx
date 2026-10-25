'use client';

import { Sparkles } from 'lucide-react';
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
  const { toggleCopilot, copilotOpen } = useAppStore();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6">
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
      >
        Copilot
      </Button>

      <NotificationBell />

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
