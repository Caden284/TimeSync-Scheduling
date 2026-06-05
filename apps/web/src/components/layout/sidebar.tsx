'use client';

import { cn, getContrastColor } from '@/lib/utils';
import { useAppStore } from '@/store';
import { loadSetup, clearSetup } from '@/lib/org-store';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Calendar, Users, ShieldCheck, BarChart3, MessageSquareMore,
  Settings, ChevronLeft, ChevronRight, Zap, Clock, FileText,
  Globe, LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/schedule',  label: 'Schedule',    icon: Calendar,          section: 'main' },
  { href: '/employees', label: 'Employees',   icon: Users,             section: 'main' },
  { href: '/rules',     label: 'Rule Engine', icon: ShieldCheck,       section: 'main' },
  { href: '/analytics', label: 'Analytics',   icon: BarChart3,         section: 'main' },
  { href: '/copilot',   label: 'AI Copilot',  icon: MessageSquareMore, section: 'main' },
  { href: '/time-off',  label: 'Time Off',    icon: Clock,             section: 'secondary' },
  { href: '/reports',   label: 'Reports',     icon: FileText,          section: 'secondary' },
  { href: '/locations', label: 'Locations',   icon: Globe,             section: 'secondary' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const [orgName, setOrgName] = useState('TimeSync');
  const [orgColor, setOrgColor] = useState('#6366f1');
  const [orgInitials, setOrgInitials] = useState('TS');

  useEffect(() => {
    const setup = loadSetup();
    if (setup) {
      setOrgName(setup.org.name);
      setOrgColor(setup.org.primaryColor);
      setOrgInitials(setup.org.logoInitials);
    }
  }, []);

  function handleReset() {
    if (confirm('Reset TimeSync and start a new organization? All local data will be cleared.')) {
      clearSetup();
      router.replace('/onboarding');
    }
  }

  const logoFg = getContrastColor(orgColor);

  return (
    <aside className={cn(
      'flex flex-col bg-gray-950 text-gray-300 transition-all duration-200 ease-in-out h-screen sticky top-0 z-30 border-r border-gray-800',
      sidebarCollapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800 shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm"
          style={{ backgroundColor: orgColor, color: logoFg }}>
          {orgInitials}
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-none truncate max-w-[140px]">{orgName}</p>
            <p className="text-xs text-gray-500 mt-0.5">TimeSync</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {['main', 'secondary'].map((section, si) => (
          <div key={section}>
            {si > 0 && <div className="my-3 border-t border-gray-800" />}
            {navItems.filter(i => i.section === section).map(item => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
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

      {/* Bottom */}
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

        {/* Reset / New org */}
        <button
          onClick={handleReset}
          title={sidebarCollapsed ? 'Start new organization' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!sidebarCollapsed && <span className="text-xs">New Organization</span>}
        </button>

        {/* User badge */}
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1',
          sidebarCollapsed && 'justify-center px-2'
        )}>
          <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: orgColor, color: logoFg }}>
            {orgInitials[0] ?? '?'}
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-medium text-white truncate">{orgName}</p>
              <p className="text-[10px] text-gray-500 truncate">Administrator</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors shadow-sm"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
