/**
 * TimeSync — Appwrite Database Setup Script
 *
 * Run once to create all collections and attributes:
 *   node scripts/setup-appwrite.mjs YOUR_API_KEY
 */

import { Client, Databases, Permission, Role } from 'node-appwrite';

const ENDPOINT   = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = '6a5ac65d000f4a62b039';
const DATABASE_ID = 'timesync-db';
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: node scripts/setup-appwrite.mjs YOUR_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const db = new Databases(client);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeCreate(fn, label) {
  try {
    const result = await fn();
    console.log(`  ✅ ${label}`);
    return result;
  } catch (e) {
    if (e.code === 409) {
      console.log(`  ⏭  ${label} (already exists)`);
    } else {
      console.error(`  ❌ ${label}: ${e.message}`);
    }
  }
}

// ── 1. Create Database ────────────────────────────────────────────────────────

async function createDatabase() {
  console.log('\n📦 Creating database…');
  await safeCreate(
    () => db.create(DATABASE_ID, 'TimeSync Database'),
    'Database: timesync-db'
  );
}

// ── 2. Collections ────────────────────────────────────────────────────────────

const anyRead  = [Permission.read(Role.any())];
const userCRUD = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function createCollections() {
  console.log('\n📋 Creating collections…');

  const collections = [
    { id: 'organizations',      name: 'Organizations' },
    { id: 'departments',        name: 'Departments' },
    { id: 'locations',          name: 'Locations' },
    { id: 'employees',          name: 'Employees' },
    { id: 'schedules',          name: 'Schedules' },
    { id: 'shifts',             name: 'Shifts' },
    { id: 'shift_assignments',  name: 'Shift Assignments' },
    { id: 'time_off_requests',  name: 'Time Off Requests' },
    { id: 'user_profiles',      name: 'User Profiles' },
    { id: 'scheduling_rules',      name: 'Scheduling Rules' },
    { id: 'seasons',               name: 'Seasons' },
    { id: 'shift_templates',       name: 'Shift Templates' },
    { id: 'availability_overrides', name: 'Availability Overrides' },
  ];

  for (const col of collections) {
    await safeCreate(
      () => db.createCollection(DATABASE_ID, col.id, col.name, userCRUD),
      `Collection: ${col.name}`
    );
    await sleep(300);
  }
}

// ── 3. Attributes ─────────────────────────────────────────────────────────────

async function addAttr(colId, fn, label) {
  await safeCreate(() => fn(), `  ${colId}.${label}`);
  await sleep(200);
}

async function createAttributes() {
  console.log('\n🔧 Creating attributes…');

  // organizations
  const orgAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'organizations', 'name', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'organizations', 'vertical', 60, false),
    () => db.createStringAttribute(DATABASE_ID, 'organizations', 'timezone', 60, false),
    () => db.createStringAttribute(DATABASE_ID, 'organizations', 'primaryColor', 20, false),
    () => db.createStringAttribute(DATABASE_ID, 'organizations', 'logoInitials', 4, false),
  ];
  for (const fn of orgAttrs) { await safeCreate(fn, 'organizations attr'); await sleep(200); }

  // departments
  const deptAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'departments', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'departments', 'name', 80, true),
    () => db.createStringAttribute(DATABASE_ID, 'departments', 'color', 20, false),
  ];
  for (const fn of deptAttrs) { await safeCreate(fn, 'departments attr'); await sleep(200); }

  // locations
  const locAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'locations', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'locations', 'name', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'locations', 'city', 80, false),
    () => db.createStringAttribute(DATABASE_ID, 'locations', 'state', 40, false),
    () => db.createStringAttribute(DATABASE_ID, 'locations', 'address', 200, false),
  ];
  for (const fn of locAttrs) { await safeCreate(fn, 'locations attr'); await sleep(200); }

  // employees
  const empAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'firstName', 60, true),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'lastName', 60, true),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'email', 120, false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'role', 60, false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'departmentId', 36, false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'departmentName', 80, false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'employmentType', 20, false),
    () => db.createFloatAttribute(DATABASE_ID, 'employees', 'payRate', false),
    () => db.createBooleanAttribute(DATABASE_ID, 'employees', 'isActive', false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'phone', 30, false),
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'avatarColor', 20, false),
  ];
  for (const fn of empAttrs) { await safeCreate(fn, 'employees attr'); await sleep(200); }

  // schedules
  const schedAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'schedules', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'schedules', 'weekStart', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'schedules', 'weekEnd', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'schedules', 'status', 20, false, 'draft'),
    () => db.createStringAttribute(DATABASE_ID, 'schedules', 'name', 120, false),
  ];
  for (const fn of schedAttrs) { await safeCreate(fn, 'schedules attr'); await sleep(200); }

  // shifts
  const shiftAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'scheduleId', 36, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'title', 120, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'date', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'startTime', 8, true),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'endTime', 8, true),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'departmentId', 36, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'departmentName', 80, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'departmentColor', 20, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'locationId', 36, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'locationName', 120, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'shiftType', 20, false, 'fixed'),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'status', 20, false, 'scheduled'),
    () => db.createBooleanAttribute(DATABASE_ID, 'shifts', 'isOpen', false, false),
    () => db.createIntegerAttribute(DATABASE_ID, 'shifts', 'minStaff', false, 1, 1, 500),
    () => db.createIntegerAttribute(DATABASE_ID, 'shifts', 'maxStaff', false, undefined, 1, 500),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'color', 20, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'notes', 500, false),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'assignedEmployeeIds', 36, false, undefined, true),
    () => db.createStringAttribute(DATABASE_ID, 'shifts', 'assignedEmployeeNames', 120, false, undefined, true),
  ];
  for (const fn of shiftAttrs) { await safeCreate(fn, 'shifts attr'); await sleep(200); }

  // shift_assignments
  const assignAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'shift_assignments', 'shiftId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_assignments', 'employeeId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_assignments', 'employeeName', 120, false),
    () => db.createStringAttribute(DATABASE_ID, 'shift_assignments', 'status', 20, false, 'confirmed'),
  ];
  for (const fn of assignAttrs) { await safeCreate(fn, 'shift_assignments attr'); await sleep(200); }

  // time_off_requests
  const torAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'employeeId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'employeeName', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'leaveType', 40, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'startDate', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'endDate', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'reason', 500, false),
    () => db.createStringAttribute(DATABASE_ID, 'time_off_requests', 'status', 20, false, 'pending'),
  ];
  for (const fn of torAttrs) { await safeCreate(fn, 'time_off_requests attr'); await sleep(200); }

  // scheduling_rules
  const ruleAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'name', 255, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'ruleType', 60, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'constraintType', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'description', 500, false),
    () => db.createBooleanAttribute(DATABASE_ID, 'scheduling_rules', 'isEnabled', false, true),
    () => db.createBooleanAttribute(DATABASE_ID, 'scheduling_rules', 'isSystem', false, false),
    () => db.createIntegerAttribute(DATABASE_ID, 'scheduling_rules', 'priority', false, 1, 200, 50),
    () => db.createFloatAttribute(DATABASE_ID, 'scheduling_rules', 'weight', false),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'parameters', 2000, false, '{}'),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'scopeDepts', 36, false, undefined, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'scopeLocations', 36, false, undefined, true),
    () => db.createStringAttribute(DATABASE_ID, 'scheduling_rules', 'scopeRoles', 36, false, undefined, true),
  ];
  for (const fn of ruleAttrs) { await safeCreate(fn, 'scheduling_rules attr'); await sleep(200); }

  // seasons
  const seasonAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'name', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'seasonType', 40, true),
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'startDate', 10, true),
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'endDate', 10, true),
    () => db.createBooleanAttribute(DATABASE_ID, 'seasons', 'isActive', false, false),
    () => db.createStringAttribute(DATABASE_ID, 'seasons', 'hoursJson', 2000, false, '{}'),
  ];
  for (const fn of seasonAttrs) { await safeCreate(fn, 'seasons attr'); await sleep(200); }

  // shift_templates
  const tmplAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'seasonId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'name', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'startTime', 8, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'endTime', 8, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'color', 20, false, '#6366f1'),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'departmentId', 36, false),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'departmentName', 80, false),
    () => db.createIntegerAttribute(DATABASE_ID, 'shift_templates', 'minStaff', false, 1, 500, 1),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'daysOfWeek', 30, false, '[1,2,3,4,5]'),
    () => db.createBooleanAttribute(DATABASE_ID, 'shift_templates', 'isActive', false, true),
    () => db.createStringAttribute(DATABASE_ID, 'shift_templates', 'notes', 500, false),
  ];
  for (const fn of tmplAttrs) { await safeCreate(fn, 'shift_templates attr'); await sleep(200); }

  // availability_overrides
  const aoAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'employeeId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'employeeName', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'date', 10, true),
    () => db.createBooleanAttribute(DATABASE_ID, 'availability_overrides', 'isAvailable', true),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'reason', 255, false),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'altStartTime', 8, false),
    () => db.createStringAttribute(DATABASE_ID, 'availability_overrides', 'altEndTime', 8, false),
  ];
  for (const fn of aoAttrs) { await safeCreate(fn, 'availability_overrides attr'); await sleep(200); }

  // weeklyAvailability on employees (new attribute)
  await safeCreate(
    () => db.createStringAttribute(DATABASE_ID, 'employees', 'weeklyAvailability', 2000, false, '{}'),
    'employees.weeklyAvailability'
  );
  await sleep(200);

  // user_profiles
  const upAttrs = [
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'userId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'role', 20, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'orgId', 36, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'firstName', 60, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'lastName', 60, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'email', 120, true),
    () => db.createStringAttribute(DATABASE_ID, 'user_profiles', 'employeeId', 36, false),
  ];
  for (const fn of upAttrs) { await safeCreate(fn, 'user_profiles attr'); await sleep(200); }
}

// ── 4. Indexes ────────────────────────────────────────────────────────────────

async function createIndexes() {
  console.log('\n🗂  Creating indexes…');
  const indexes = [
    ['departments',       'idx_dept_org',    ['orgId']],
    ['locations',         'idx_loc_org',     ['orgId']],
    ['employees',         'idx_emp_org',     ['orgId']],
    ['shifts',            'idx_shift_org',   ['orgId']],
    ['shifts',            'idx_shift_date',  ['date']],
    ['time_off_requests', 'idx_tor_org',     ['orgId']],
    ['time_off_requests', 'idx_tor_status',  ['status']],
    ['user_profiles',       'idx_up_userId',    ['userId']],
    ['schedules',           'idx_sched_org',    ['orgId']],
    ['scheduling_rules',    'idx_rules_org',    ['orgId']],
    ['scheduling_rules',    'idx_rules_type',   ['constraintType']],
    ['seasons',             'idx_seasons_org',  ['orgId']],
    ['shift_templates',     'idx_tmpl_org',     ['orgId']],
    ['shift_templates',     'idx_tmpl_season',  ['seasonId']],
    ['availability_overrides', 'idx_ao_emp',    ['employeeId']],
    ['availability_overrides', 'idx_ao_date',   ['date']],
  ];

  for (const [col, key, attrs] of indexes) {
    await safeCreate(
      () => db.createIndex(DATABASE_ID, col, key, 'key', attrs),
      `${col}.${key}`
    );
    await sleep(300);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('🚀 TimeSync — Appwrite Setup');
console.log(`   Endpoint:   ${ENDPOINT}`);
console.log(`   Project:    ${PROJECT_ID}`);
console.log(`   Database:   ${DATABASE_ID}`);

try {
  await createDatabase();
  await createCollections();
  await createAttributes();
  await createIndexes();

  console.log('\n✅ Setup complete! Your Appwrite database is ready.');
  console.log('\nNext steps:');
  console.log('  1. Go to Appwrite Console → Auth → Settings → enable Email/Password');
  console.log('  2. Run: cd apps/web && npm run dev');
  console.log('  3. Open http://localhost:3000 → you will see the login page');
  console.log('  4. Use the /setup-admin page to create your first admin account\n');
} catch (e) {
  console.error('\n❌ Setup failed:', e.message);
  process.exit(1);
}
