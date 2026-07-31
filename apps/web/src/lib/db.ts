'use client';

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from './appwrite';
import { Permission, Role } from 'appwrite';

// Any logged-in user can read, update, and delete documents created by this app
function userPerms() {
  return [
    Permission.read(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getOrg(orgId: string) {
  return databases.getDocument(DATABASE_ID, COLLECTIONS.ORGANIZATIONS, orgId);
}

export async function createOrg(data: {
  name: string; vertical: string; timezone: string;
  primaryColor: string; logoInitials: string;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.ORGANIZATIONS, ID.unique(), data, userPerms());
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
  return databases.createDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, ID.unique(), { orgId, name, color }, userPerms());
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
  return databases.createDocument(DATABASE_ID, COLLECTIONS.LOCATIONS, ID.unique(), { orgId, ...data }, userPerms());
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
  firstName: string; lastName: string; email: string; phone?: string;
  role: string; departmentId?: string; employmentType: string; payRate?: number;
}) {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, ID.unique(), {
    orgId, ...data, isActive: true,
  }, userPerms());
}

export async function updateEmployee(employeeId: string, data: Record<string, unknown>) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, employeeId, data);
}

export async function deleteEmployee(employeeId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.EMPLOYEES, employeeId);
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
  }, userPerms());
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
  return databases.createDocument(DATABASE_ID, COLLECTIONS.SHIFTS, ID.unique(), data, userPerms());
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
  }, userPerms());
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
  }, userPerms());
}

export async function updateTimeOffStatus(requestId: string, status: 'approved' | 'denied') {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.TIME_OFF_REQUESTS, requestId, { status });
}

// ── Scheduling Rules ──────────────────────────────────────────────────────────

export async function getRules(orgId: string) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHEDULING_RULES, [
    Query.equal('orgId', orgId),
    Query.orderAsc('priority'),
    Query.limit(200),
  ]);
  return res.documents.map(docToRule);
}

export async function createRule(orgId: string, data: {
  name: string; ruleType: string; constraintType: string;
  description?: string; isEnabled?: boolean; isSystem?: boolean;
  priority: number; weight?: number; parameters?: Record<string, unknown>;
  scopeDepts?: string[]; scopeLocations?: string[]; scopeRoles?: string[];
}) {
  const doc = await databases.createDocument(
    DATABASE_ID, COLLECTIONS.SCHEDULING_RULES, ID.unique(),
    {
      orgId,
      name: data.name,
      ruleType: data.ruleType,
      constraintType: data.constraintType,
      description: data.description ?? '',
      isEnabled: data.isEnabled ?? true,
      isSystem: data.isSystem ?? false,
      priority: data.priority,
      weight: data.weight ?? null,
      parameters: data.parameters ? JSON.stringify(data.parameters) : '{}',
      scopeDepts: data.scopeDepts ?? [],
      scopeLocations: data.scopeLocations ?? [],
      scopeRoles: data.scopeRoles ?? [],
    },
    userPerms()
  );
  return docToRule(doc);
}

export async function updateRule(ruleId: string, patch: {
  name?: string; description?: string; isEnabled?: boolean;
  priority?: number; weight?: number; parameters?: Record<string, unknown>;
}) {
  const data: Record<string, unknown> = { ...patch };
  if (patch.parameters !== undefined) {
    data.parameters = JSON.stringify(patch.parameters);
    delete data.parameters; // re-add as string
    data.parameters = JSON.stringify(patch.parameters);
  }
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULING_RULES, ruleId, data);
}

export async function toggleRule(ruleId: string, isEnabled: boolean) {
  return databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULING_RULES, ruleId, { isEnabled });
}

export async function deleteRule(ruleId: string) {
  return databases.deleteDocument(DATABASE_ID, COLLECTIONS.SCHEDULING_RULES, ruleId);
}

function docToRule(doc: any) {
  return {
    id: doc.$id,
    orgId: doc.orgId,
    name: doc.name,
    ruleType: doc.ruleType,
    constraintType: doc.constraintType as 'hard' | 'soft',
    description: doc.description ?? '',
    isEnabled: doc.isEnabled ?? true,
    isSystem: doc.isSystem ?? false,
    priority: doc.priority ?? 50,
    weight: doc.weight ?? undefined,
    parameters: (() => { try { return JSON.parse(doc.parameters ?? '{}'); } catch { return {}; } })(),
    conditions: [],
    scopeDepts: doc.scopeDepts ?? [],
    scopeLocations: doc.scopeLocations ?? [],
    scopeRoles: doc.scopeRoles ?? [],
    createdAt: doc.$createdAt,
  };
}
