'use client';

import type { User } from '@supabase/supabase-js';
import { supabase, TABLES, fromRow, authHeaders } from './supabase';

export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  userId: string;
  role: UserRole;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId?: string;
}

interface PendingOrg { name: string; vertical?: string; timezone?: string }

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const result = await getCurrentUser();
  if (!result) {
    await supabase.auth.signOut();
    throw new Error('This account is not linked to an organization. Ask your administrator for access.');
  }
  return result;
}

export async function signOut() {
  await supabase.auth.signOut();
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from(TABLES.USER_PROFILES)
    .select().eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function getCurrentUser(): Promise<{ session: User; profile: UserProfile } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let doc = await fetchProfile(user.id);
    // An admin who signed up while email confirmation was required finishes
    // creating their organization on first sign-in.
    const pending = user.user_metadata?.pending_org as PendingOrg | undefined;
    if (!doc && pending?.name) {
      await bootstrapOrganization(pending, user.user_metadata?.first_name, user.user_metadata?.last_name);
      doc = await fetchProfile(user.id);
    }
    if (!doc) return null;
    return {
      session: user,
      profile: {
        userId: doc.userId,
        role: doc.role as UserRole,
        orgId: doc.orgId,
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email,
        employeeId: doc.employeeId ?? undefined,
      },
    };
  } catch {
    return null;
  }
}

async function bootstrapOrganization(org: PendingOrg, firstName = '', lastName = '') {
  const { data, error } = await supabase.rpc('bootstrap_organization', {
    p_org_name: org.name,
    p_vertical: org.vertical ?? null,
    p_timezone: org.timezone ?? null,
    p_first_name: firstName,
    p_last_name: lastName,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// First-time setup: creates the auth account, then the organization with the
// caller as its admin. Returns 'confirm_email' when the Supabase project
// requires email confirmation — the org is created on first sign-in instead.
export async function signUpAdmin(input: {
  email: string; password: string; firstName: string; lastName: string;
  orgName: string; vertical: string; timezone: string;
}): Promise<'ready' | 'confirm_email'> {
  const pendingOrg: PendingOrg = { name: input.orgName, vertical: input.vertical, timezone: input.timezone };
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { first_name: input.firstName, last_name: input.lastName, pending_org: pendingOrg },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.session) return 'confirm_email';
  await bootstrapOrganization(pendingOrg, input.firstName, input.lastName);
  return 'ready';
}

// Emails a password-reset link that returns the user to /reset-password.
// The link only works if that URL is allowed under Supabase → Authentication →
// URL Configuration → Redirect URLs.
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

// Sets a new password for the signed-in user (the reset link signs them in).
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// Invite a staff or admin user into the caller's organization. Runs on the
// server (/api/admin/users) because creating another user's account needs the
// service-role key, and the server re-checks that the caller is an admin.
export async function inviteUser(email: string, password: string, firstName: string, lastName: string, role: 'admin' | 'staff', employeeId?: string) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ email, password, firstName, lastName, role, employeeId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Failed to create user (${res.status})`);
  return body;
}
