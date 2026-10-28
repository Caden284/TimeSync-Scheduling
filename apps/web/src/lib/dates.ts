// Calendar-date helpers that work in the user's local time zone.
// Avoid `toISOString().split('T')[0]`: that's the UTC date, which is
// "tomorrow" in the US evening and "yesterday" east of UTC.

import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Parses yyyy-MM-dd as a local date (no time-zone shift).
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

// Weeks run Sunday–Saturday, matching the calendar and the `schedules` table.
export function weekRange(iso: string): { start: string; end: string } {
  const d = parseISODate(iso);
  return {
    start: toISODate(startOfWeek(d, { weekStartsOn: 0 })),
    end:   toISODate(endOfWeek(d,   { weekStartsOn: 0 })),
  };
}
