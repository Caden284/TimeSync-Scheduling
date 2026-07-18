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

export async function createAdminUser(email: string, password: string, firstName: string, lastName: string, orgId: string) {
  const user = await account.create(ID.unique(), email, password, `${firstName} ${lastName}`);
  await account.createEmailPasswordSession(email, password);
  await databases.createDocument(DATABASE_ID, COLLECTIONS.USER_PROFILES, ID.unique(), {
    userId: user.$id,
    role: 'admin',
    orgId,
    firstName,
    lastName,
    email,
  });
  return user;
}
