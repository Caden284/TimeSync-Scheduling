import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isToday, isSameDay } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatHours(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatShiftTime(startTime: string, endTime: string) {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

export function getWeekDays(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export function getEmployeeDisplayName(employee: { firstName: string; lastName: string; preferredName?: string | null }) {
  return employee.preferredName
    ? `${employee.preferredName} ${employee.lastName}`
    : `${employee.firstName} ${employee.lastName}`;
}

export function employmentTypeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    full_time:  { label: 'Full-Time',  className: 'bg-blue-100 text-blue-800' },
    part_time:  { label: 'Part-Time',  className: 'bg-purple-100 text-purple-800' },
    per_diem:   { label: 'Per Diem',   className: 'bg-yellow-100 text-yellow-800' },
    contract:   { label: 'Contract',   className: 'bg-orange-100 text-orange-800' },
    seasonal:   { label: 'Seasonal',   className: 'bg-green-100 text-green-800' },
    intern:     { label: 'Intern',     className: 'bg-teal-100 text-teal-800' },
    volunteer:  { label: 'Volunteer',  className: 'bg-pink-100 text-pink-800' },
  };
  return map[type] ?? { label: type, className: 'bg-gray-100 text-gray-700' };
}

export function coverageColor(pct: number) {
  if (pct >= 100) return '#22c55e';
  if (pct >= 80)  return '#84cc16';
  if (pct >= 60)  return '#eab308';
  if (pct >= 40)  return '#f97316';
  return '#ef4444';
}

export function shiftStatusColor(status: string) {
  const map: Record<string, string> = {
    scheduled:   'bg-blue-500',
    open:        'bg-amber-500',
    in_progress: 'bg-green-500',
    completed:   'bg-gray-400',
    cancelled:   'bg-red-400',
    no_show:     'bg-red-600',
  };
  return map[status] ?? 'bg-gray-400';
}

export function parseShiftTime(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m, s] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m, s ?? 0);
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateColor(seed: string) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
    '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#a855f7', '#d946ef', '#f59e0b', '#10b981',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function formatDateRange(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  if (isSameDay(s, e)) return format(s, 'EEEE, MMMM d, yyyy');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${format(s, 'MMMM d')}–${format(e, 'd, yyyy')}`;
  return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
}

export function clampHours(hours: number) {
  return Math.max(0, Math.min(hours, 24));
}

export function getContrastColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#111827' : '#ffffff';
}
