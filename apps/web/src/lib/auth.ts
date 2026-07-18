'use client';

import { account, databases, DATABASE_ID, COLLECTIONS, ID, Query } from './appwrite';
import type { Models } from 'appwrite';

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

export async function signIn(email: string, password: string) {
  await account.createEmailPasswordSession(email, password);
  return getCurrentUser();
}

export async function signOut() {
  await account.deleteSession('current');
}

export async function getCurrentUser(): Promise<{ session: Models.User<Models.Preferences>; profile: UserProfile } | null> {
  try {
    const session = await account.get();
    const profiles = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
      Query.equal('userId', session.$id),
    ]);
    if (profiles.total === 0) return null;
    const doc = profiles.documents[0];
    return {
      session,
      profile: {
        userId: doc.userId,
        role: doc.role as UserRole,
        orgId: doc.orgId,
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email,
        employeeId: doc.employeeId,
      },
    };
  } catch {
    return null;
  }
}

// Step 1: create the Appwrite auth account and sign in (no DB writes — guest scope)
export async function createAdminUser(email: string, password: string, firstName: string, lastName: string) {
  const user = await account.create(ID.unique(), email, password, `${firstName} ${lastName}`);
  await account.createEmailPasswordSession(email, password);
  return user;
}

// Step 2: called after sign-in and org creation — writes profile as authenticated user
export async function linkProfileToOrg(orgId: string) {
  const session = await account.get();
  const name = session.name.split(' ');
  return databases.createDocument(DATABASE_ID, COLLECTIONS.USER_PROFILES, ID.unique(), {
    userId: session.$id,
    role: 'admin',
    orgId,
    firstName: name[0] ?? '',
    lastName: name.slice(1).join(' ') ?? '',
    email: session.email,
  });
}

// Invite a staff or admin user (called while admin is already signed in)
export async function inviteUser(email: string, password: string, firstName: string, lastName: string, role: 'admin' | 'staff', orgId: string, employeeId?: string) {
  const user = await account.create(ID.unique(), email, password, `${firstName} ${lastName}`);
  // Create the profile document as the currently-signed-in admin
  await databases.createDocument(DATABASE_ID, COLLECTIONS.USER_PROFILES, ID.unique(), {
    userId: user.$id,
    role,
    orgId,
    firstName,
    lastName,
    email,
    employeeId: employeeId ?? null,
  });
  return user;
}
