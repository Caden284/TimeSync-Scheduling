import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Supabase now calls this the "publishable" key; older projects call it the anon key.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

// Client-side Supabase client (session persisted in localStorage).
// Placeholder values keep `next build` from crashing when env vars are absent.
export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_PUBLISHABLE_KEY || 'missing-publishable-key',
);

// Table names (must match supabase/migrations)
export const TABLES = {
  ORGANIZATIONS:          'organizations',
  DEPARTMENTS:            'departments',
  LOCATIONS:              'locations',
  EMPLOYEES:              'employees',
  SHIFTS:                 'shifts',
  SHIFT_ASSIGNMENTS:      'shift_assignments',
  TIME_OFF_REQUESTS:      'time_off_requests',
  SCHEDULES:              'schedules',
  USER_PROFILES:          'user_profiles',
  SCHEDULING_RULES:       'scheduling_rules',
  SEASONS:                'seasons',
  SHIFT_TEMPLATES:        'shift_templates',
  AVAILABILITY_OVERRIDES: 'availability_overrides',
  NOTIFICATIONS:          'notifications',
} as const;

// Authorization header for calls to our own Next.js API routes.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Row mapping ───────────────────────────────────────────────────────────────
// Postgres columns are snake_case; the UI works in camelCase.

const toCamelKey = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnakeKey = (k: string) => k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

export function fromRow<T = any>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[toCamelKey(k)] = v;
  return out as T;
}

// Drops undefined values so partial updates leave untouched columns alone.
export function toRow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[toSnakeKey(k)] = v;
  return out;
}

// Unwraps a Supabase response, throwing its error so callers can toast e.message.
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
