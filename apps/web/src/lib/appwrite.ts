import { Client, Account, Databases, Query, ID } from 'appwrite';

export const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? '6a5ac65d000f4a62b039';
export const DATABASE_ID = 'timesync-db';

// Collection IDs (must match what setup script creates)
export const COLLECTIONS = {
  ORGANIZATIONS:      'organizations',
  DEPARTMENTS:        'departments',
  LOCATIONS:          'locations',
  EMPLOYEES:          'employees',
  SHIFTS:             'shifts',
  SHIFT_ASSIGNMENTS:  'shift_assignments',
  TIME_OFF_REQUESTS:  'time_off_requests',
  SCHEDULES:          'schedules',
  USER_PROFILES:      'user_profiles',
} as const;

// Client-side Appwrite client (uses browser session)
export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const account  = new Account(client);
export const databases = new Databases(client);

export { Query, ID };
