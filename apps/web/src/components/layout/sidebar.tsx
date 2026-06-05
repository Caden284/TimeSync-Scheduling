'use client';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar, Users, ShieldCheck, BarChart3, MessageSquareMore,
  Settings, ChevronLeft, ChevronRight, Zap, Clock, Bell,
  LayoutDashboard, FileText, Globe,
} from 'lucide-react';

const navItems = [
  { href: '/schedule',   label: 'Schedule',   icon: Calendar,           section: 'main' },
  { href: '/employees',  label: 'Employees',  icon: Users,              section: 'main' },
  { href: '/rules',      label: 'Rule Engine',icon: ShieldCheck,        section: 'main' },
  { href: '/analytics',  label: 'Analytics',  icon: BarChart3,          section: 'main' },
  { href: '/copilot',    label: 'AI Copilot', icon: MessageSquareMore,  section: 'main' },
  { href: '/time-off',   label: 'Time Off',   icon: Clock,              section: 'secondary' },
  { href: '/reports',    label: 'Reports',    icon: FileText,           section: 'secondary' },
  { href: '/locations',  label: 'Locations',  icon: Globe,              section: 'secondary' },
  { href: '/settings',   label: 'Settings',   icon: Settings,           section: 'bottom' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, org } = useAppStore();
  const pathname = usePathname();

  return (
    <aside className={cn(
      'flex flex-col bg-gray-950 text-gray-300 transition-all duration-200 ease-in-out h-screen sticky top-0 z-30 border-r border-gray-800',
      sidebarCollapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800 shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-none">TimeSync</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{org?.name ?? 'Scheduling'}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {['main', 'secondary'].map((section, si) => (
          <div key={section}>
            {si > 0 && <div className="my-3 border-t border-gray-800" />}
            {navItems.filter((i) => i.section === section).map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {!sidebarCollapsed && item.href === '/copilot' && (
                    <span className="ml-auto rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="shrink-0 border-t border-gray-800 p-2 space-y-0.5">
        <Link
          href="/settings"
          title={sidebarCollapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <Settings size={18} className="shrink-0" />
          {!sidebarCollapsed && 'Settings'}
        </Link>

        {/* User */}
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1',
          sidebarCollapsed && 'justify-center px-2'
        )}>
          <div className="h-7 w-7 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            M
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">Morgan Davis</p>
              <p className="text-[10px] text-gray-500 truncate">Scheduler</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors shadow-sm"
      >
        {sidebarCollapsed
          ? <ChevronRight size={12} />
          : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
