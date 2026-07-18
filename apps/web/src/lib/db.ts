'use client';

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from './appwrite';

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getOrg(orgId: string) {
  return databases.getDocument(DATABASE_ID, COLLECTIONS.ORGANIZATIONS, orgId);
}

export async function createOrg(data: {
  name: string; vertical: string; timezone: string;
  primaryColor: string; logoInitials: string;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.ORGANIZATIONS, ID.unique(), data);
}

export async function updateOrg(orgId: string, data: Partial<{
  name: string; vertical: string; timezone: string;
  primaryColor: string; logoInitials: string;
}>) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.ORGANIZATIONS, orgId, data);
}

// ── Departments ───────────────────────────────────────────────────────────────

export async function getDepartments(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
    Query.equal('orgId', orgId),
    Query.orderAsc('name'),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createDepartment(orgId: string, name: string, color: string) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, ID.unique(), { orgId, name, color });
}

export async function deleteDepartment(deptId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, deptId);
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function getLocations(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.LOCATIONS, [
    Query.equal('orgId', orgId),
    Query.orderAsc('name'),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createLocation(orgId: string, data: { name: string; city?: string; state?: string }) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.LOCATIONS, ID.unique(), { orgId, ...data });
}

export async function deleteLocation(locationId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOCATIONS, locationId);
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function getEmployees(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EMPLOYEES, [
    Query.equal('orgId', orgId),
    Query.equal('isActive', true),
    Query.orderAsc('lastName'),
    Query.limit(500),
  ]);
  return res.documents;
}

export async function createEmployee(orgId: string, data: {
  firstName: string; lastName: string; email: string;
  role: string; departmentId?: string; employmentType: string; payRate?: number;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, ID.unique(), {
    orgId, ...data, isActive: true,
  });
}

export async function updateEmployee(employeeId: string, data: Record<string, unknown>) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, employeeId, data);
}

export async function deleteEmployee(employeeId: string) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, employeeId, { isActive: false });
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export async function getSchedules(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHEDULES, [
    Query.equal('orgId', orgId),
    Query.orderDesc('weekStart'),
    Query.limit(52),
  ]);
  return res.documents;
}

export async function createSchedule(orgId: string, weekStart: string, weekEnd: string) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.SCHEDULES, ID.unique(), {
    orgId, weekStart, weekEnd, status: 'draft',
  });
}

export async function updateScheduleStatus(scheduleId: string, status: 'draft' | 'review' | 'published') {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULES, scheduleId, { status });
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function getShifts(orgId: string, weekStart?: string, weekEnd?: string) {
  const filters = [Query.equal('orgId', orgId), Query.limit(500)];
  if (weekStart) filters.push(Query.greaterThanEqual('date', weekStart));
  if (weekEnd)   filters.push(Query.lessThanEqual('date', weekEnd));
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SHIFTS, filters);
  return res.documents;
}

export async function createShift(data: {
  orgId: string; scheduleId?: string; title?: string;
  date: string; startTime: string; endTime: string;
  departmentId?: string; departmentName?: string; departmentColor?: string;
  locationId?: string; locationName?: string;
  shiftType: string; status: string; isOpen: boolean;
  minStaff: number; maxStaff?: number; color?: string; notes?: string;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.SHIFTS, ID.unique(), data);
}

export async function updateShift(shiftId: string, data: Record<string, unknown>) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.SHIFTS, shiftId, data);
}

export async function deleteShift(shiftId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.SHIFTS, shiftId);
}

// ── Shift Assignments ─────────────────────────────────────────────────────────

export async function getAssignments(shiftId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SHIFT_ASSIGNMENTS, [
    Query.equal('shiftId', shiftId),
  ]);
  return res.documents;
}

export async function assignEmployee(shiftId: string, employeeId: string, employeeName: string) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.SHIFT_ASSIGNMENTS, ID.unique(), {
    shiftId, employeeId, employeeName, status: 'confirmed',
  });
}

export async function removeAssignment(assignmentId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.SHIFT_ASSIGNMENTS, assignmentId);
}

// ── Time Off Requests ─────────────────────────────────────────────────────────

export async function getTimeOffRequests(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TIME_OFF_REQUESTS, [
    Query.equal('orgId', orgId),
    Query.orderDesc('$createdAt'),
    Query.limit(200),
  ]);
  return res.documents;
}

export async function createTimeOffRequest(data: {
  orgId: string; employeeId: string; employeeName: string;
  leaveType: string; startDate: string; endDate: string; reason?: string;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.TIME_OFF_REQUESTS, ID.unique(), {
    ...data, status: 'pending',
  });
}

export async function updateTimeOffStatus(requestId: string, status: 'approved' | 'denied') {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.TIME_OFF_REQUESTS, requestId, { status });
}
