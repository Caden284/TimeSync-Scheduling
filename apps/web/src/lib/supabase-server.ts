// Server-only Supabase helpers for Next.js route handlers.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Supabase now calls this the "secret" key; older projects call it the service-role key.
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function jsonError(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : 'Unexpected error';
  return Response.json({ error: message }, { status });
}

// Bypasses RLS. Only for actions the browser must never do itself (creating
// other users' auth accounts and profiles) — always check the caller first.
export function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new HttpError(503, 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not configured on the server.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: noSession });
}

export interface Caller {
  client: SupabaseClient;   // queries run as the caller, so RLS applies
  user: User;
  orgId: string;
  role: 'admin' | 'staff';
}

// Resolves the signed-in user from the `Authorization: Bearer <access token>`
// header the browser sends, along with their organization and role.
export async function requireCaller(req: Request): Promise<Caller> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new HttpError(503, 'Supabase is not configured on the server.');
  }
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Not signed in.');

  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Your session has expired. Sign in again.');

  const { data: profile } = await client.from('user_profiles')
    .select('org_id, role').eq('user_id', user.id).maybeSingle();
  if (!profile) throw new HttpError(403, 'This account is not linked to an organization.');

  return { client, user, orgId: profile.org_id, role: profile.role };
}
