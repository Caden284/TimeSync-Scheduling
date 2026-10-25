/**
 * TimeSync — one-time data copy from Appwrite to Supabase.
 *
 * Reads every collection in the Appwrite `timesync-db` database plus the
 * Appwrite auth users, and writes them into the Supabase schema created by
 * supabase/migrations/. Appwrite ids are remapped to new uuids consistently
 * across tables. Users keep their passwords (Appwrite's argon2/bcrypt hashes
 * are imported as-is); any user whose hash can't be imported gets a random
 * temporary password, written to ./appwrite-migration-credentials.csv.
 *
 * Run from the repository root, against an EMPTY Supabase project:
 *
 *   APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1 \
 *   APPWRITE_PROJECT_ID=<project id> \
 *   APPWRITE_API_KEY=<key with databases.read + users.read> \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=<secret / service_role key> \
 *   node scripts/migrate-appwrite-to-supabase.mjs [--dry-run]
 */

import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Client, Databases, Users, Query } from 'node-appwrite';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'timesync-db';
const CREDENTIALS_FILE = 'appwrite-migration-credentials.csv';

const env = (name, ...fallbacks) => {
  const v = [name, ...fallbacks].map(n => process.env[n]).find(Boolean);
  if (!v) { console.error(`Missing env var ${name}`); process.exit(1); }
  return v;
};

const appwrite = new Client()
  .setEndpoint(env('APPWRITE_ENDPOINT'))
  .setProject(env('APPWRITE_PROJECT_ID'))
  .setKey(env('APPWRITE_API_KEY'));
const awDb = new Databases(appwrite);
const awUsers = new Users(appwrite);

const supabase = createClient(
  env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  env('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── Read from Appwrite ───────────────────────────────────────────────────────

async function fetchAll(listFn) {
  const out = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])];
    const page = await listFn(queries);
    const items = page.documents ?? page.users;
    out.push(...items);
    if (items.length < 100) return out;
    cursor = items[items.length - 1].$id;
  }
}

async function fetchCollection(collectionId) {
  try {
    return await fetchAll(queries => awDb.listDocuments({ databaseId: DATABASE_ID, collectionId, queries }));
  } catch (e) {
    if (e.code === 404) { console.warn(`  ⚠  collection ${collectionId} not found — skipping`); return []; }
    throw e;
  }
}

// ── Id remapping ─────────────────────────────────────────────────────────────

const idMaps = {};
function assignIds(collection, docs) {
  idMaps[collection] = new Map(docs.map(d => [d.$id, randomUUID()]));
}
const mapId = (collection, oldId) => (oldId ? idMaps[collection]?.get(oldId) ?? null : null);
// Department/location ids are free text in Supabase (the UI may hold
// browser-local ids); keep unknown ids as-is.
const mapLoose = (collection, oldId) => (oldId ? mapId(collection, oldId) ?? oldId : null);
const emptyToNull = v => (v === '' || v === undefined ? null : v);
const parseJson = (raw, fallback) => {
  if (raw && typeof raw === 'object') return raw;
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const base = (collection, d) => ({ id: mapId(collection, d.$id), created_at: d.$createdAt, updated_at: d.$updatedAt });

let skipped = 0;
function withOrg(collection, docs, toRow) {
  const rows = [];
  for (const d of docs) {
    const orgId = mapId('organizations', d.orgId);
    if (!orgId) { skipped++; console.warn(`  ⚠  ${collection}/${d.$id}: unknown orgId "${d.orgId}" — skipped`); continue; }
    const row = toRow(d, orgId);
    if (row) rows.push(row);
  }
  return rows;
}

// ── Write to Supabase ────────────────────────────────────────────────────────

async function insertRows(table, rows) {
  if (DRY_RUN) { console.log(`  • ${table}: ${rows.length} rows (dry run)`); return; }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ✅ ${table}: ${rows.length} rows`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`🚚 TimeSync — Appwrite → Supabase${DRY_RUN ? ' (dry run)' : ''}`);

if (!DRY_RUN) {
  const { count, error } = await supabase.from('organizations').select('id', { count: 'exact', head: true });
  if (error) { console.error(`❌ Can't reach Supabase schema: ${error.message}. Apply supabase/migrations first.`); process.exit(1); }
  if (count > 0) { console.error('❌ Supabase already has organizations. Run this against an empty project.'); process.exit(1); }
}

console.log('\n📥 Reading Appwrite…');
const COLLECTIONS = [
  'organizations', 'departments', 'locations', 'employees', 'schedules', 'shifts',
  'shift_assignments', 'time_off_requests', 'scheduling_rules', 'seasons',
  'shift_templates', 'availability_overrides', 'user_profiles',
];
const data = {};
for (const c of COLLECTIONS) {
  data[c] = await fetchCollection(c);
  assignIds(c, data[c]);
  console.log(`  • ${c}: ${data[c].length}`);
}
const appwriteUsers = new Map((await fetchAll(queries => awUsers.list({ queries }))).map(u => [u.$id, u]));
console.log(`  • auth users: ${appwriteUsers.size}`);

console.log('\n📤 Writing Supabase…');

await insertRows('organizations', data.organizations.map(d => ({
  ...base('organizations', d),
  name: d.name, vertical: emptyToNull(d.vertical), timezone: emptyToNull(d.timezone),
  primary_color: emptyToNull(d.primaryColor), logo_initials: emptyToNull(d.logoInitials),
})));

await insertRows('departments', withOrg('departments', data.departments, (d, org_id) => ({
  ...base('departments', d), org_id, name: d.name, color: emptyToNull(d.color),
})));

await insertRows('locations', withOrg('locations', data.locations, (d, org_id) => ({
  ...base('locations', d), org_id, name: d.name,
  city: emptyToNull(d.city), state: emptyToNull(d.state), address: emptyToNull(d.address),
})));

await insertRows('employees', withOrg('employees', data.employees, (d, org_id) => ({
  ...base('employees', d), org_id,
  first_name: d.firstName, last_name: d.lastName, email: emptyToNull(d.email), phone: emptyToNull(d.phone),
  role: emptyToNull(d.role), department_id: mapLoose('departments', d.departmentId),
  department_name: emptyToNull(d.departmentName), employment_type: emptyToNull(d.employmentType),
  pay_rate: d.payRate ?? null, is_active: d.isActive ?? true, avatar_color: emptyToNull(d.avatarColor),
  weekly_availability: parseJson(d.weeklyAvailability, {}),
})));

await insertRows('schedules', withOrg('schedules', data.schedules, (d, org_id) => ({
  ...base('schedules', d), org_id, name: emptyToNull(d.name),
  week_start: d.weekStart, week_end: d.weekEnd, status: d.status ?? 'draft',
})));

await insertRows('shifts', withOrg('shifts', data.shifts, (d, org_id) => {
  // Keep only assignments that point at a migrated employee, names in step.
  const ids = [], names = [];
  (d.assignedEmployeeIds ?? []).forEach((oldId, i) => {
    const id = mapId('employees', oldId);
    if (id) { ids.push(id); names.push(d.assignedEmployeeNames?.[i] ?? ''); }
  });
  return {
    ...base('shifts', d), org_id, schedule_id: mapId('schedules', d.scheduleId),
    title: emptyToNull(d.title), date: d.date, start_time: d.startTime, end_time: d.endTime,
    department_id: mapLoose('departments', d.departmentId), department_name: emptyToNull(d.departmentName),
    department_color: emptyToNull(d.departmentColor), location_id: mapLoose('locations', d.locationId),
    location_name: emptyToNull(d.locationName), shift_type: d.shiftType ?? 'fixed',
    status: d.status ?? 'scheduled', is_open: d.isOpen ?? false,
    min_staff: d.minStaff ?? 1, max_staff: d.maxStaff ?? null, color: emptyToNull(d.color),
    notes: emptyToNull(d.notes), assigned_employee_ids: ids, assigned_employee_names: names,
  };
}));

await insertRows('shift_assignments', data.shift_assignments.flatMap(d => {
  const shift_id = mapId('shifts', d.shiftId), employee_id = mapId('employees', d.employeeId);
  if (!shift_id || !employee_id) { skipped++; return []; }
  return [{ ...base('shift_assignments', d), shift_id, employee_id,
    employee_name: emptyToNull(d.employeeName), status: d.status ?? 'confirmed' }];
}));

await insertRows('time_off_requests', withOrg('time_off_requests', data.time_off_requests, (d, org_id) => ({
  ...base('time_off_requests', d), org_id, employee_id: mapId('employees', d.employeeId),
  employee_name: d.employeeName, leave_type: d.leaveType, start_date: d.startDate,
  end_date: d.endDate, reason: emptyToNull(d.reason), status: d.status ?? 'pending',
})));

await insertRows('scheduling_rules', withOrg('scheduling_rules', data.scheduling_rules, (d, org_id) => ({
  ...base('scheduling_rules', d), org_id, name: d.name, rule_type: d.ruleType,
  constraint_type: d.constraintType, description: d.description ?? '',
  is_enabled: d.isEnabled ?? true, is_system: d.isSystem ?? false, priority: d.priority ?? 50,
  weight: d.weight ?? null, parameters: parseJson(d.parameters, {}),
  scope_depts: d.scopeDepts ?? [], scope_locations: d.scopeLocations ?? [], scope_roles: d.scopeRoles ?? [],
})));

await insertRows('seasons', withOrg('seasons', data.seasons, (d, org_id) => ({
  ...base('seasons', d), org_id, name: d.name, season_type: d.seasonType,
  start_date: d.startDate, end_date: d.endDate, is_active: d.isActive ?? false,
  hours: parseJson(d.hoursJson, {}),
})));

await insertRows('shift_templates', withOrg('shift_templates', data.shift_templates, (d, org_id) => {
  const season_id = mapId('seasons', d.seasonId);
  if (!season_id) { skipped++; return null; }
  return {
    ...base('shift_templates', d), org_id, season_id, name: d.name,
    start_time: d.startTime, end_time: d.endTime, color: d.color ?? '#6366f1',
    department_id: mapLoose('departments', d.departmentId), department_name: emptyToNull(d.departmentName),
    min_staff: d.minStaff ?? 1, days_of_week: parseJson(d.daysOfWeek, [1, 2, 3, 4, 5]),
    is_active: d.isActive ?? true, notes: emptyToNull(d.notes),
  };
}));

await insertRows('availability_overrides', withOrg('availability_overrides', data.availability_overrides, (d, org_id) => {
  const employee_id = mapId('employees', d.employeeId);
  if (!employee_id) { skipped++; return null; }
  return {
    ...base('availability_overrides', d), org_id, employee_id, employee_name: d.employeeName,
    date: d.date, is_available: d.isAvailable, reason: emptyToNull(d.reason),
    alt_start_time: emptyToNull(d.altStartTime), alt_end_time: emptyToNull(d.altEndTime),
  };
}));

// ── Users + profiles ─────────────────────────────────────────────────────────

console.log('\n👤 Migrating users…');
const tempPasswords = [];
let usersCreated = 0;
for (const p of data.user_profiles) {
  const awUser = appwriteUsers.get(p.userId);
  const orgId = mapId('organizations', p.orgId);
  if (!awUser || !orgId) { skipped++; console.warn(`  ⚠  profile ${p.email}: missing auth user or org — skipped`); continue; }

  const importHash = awUser.password && ['argon2', 'bcrypt'].includes(awUser.hash);
  if (DRY_RUN) {
    console.log(`  • ${awUser.email} (${p.role}) — ${importHash ? `keeps password (${awUser.hash})` : 'gets temporary password'}`);
    continue;
  }

  const tempPassword = importHash ? null : randomBytes(12).toString('base64url');
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: awUser.email,
    email_confirm: true,
    ...(importHash ? { password_hash: awUser.password } : { password: tempPassword }),
    user_metadata: { first_name: p.firstName, last_name: p.lastName },
  });
  if (error) { skipped++; console.warn(`  ⚠  ${awUser.email}: ${error.message} — skipped`); continue; }

  const { error: profileErr } = await supabase.from('user_profiles').insert({
    user_id: created.user.id, org_id: orgId, role: p.role,
    first_name: p.firstName ?? '', last_name: p.lastName ?? '', email: p.email ?? awUser.email,
    employee_id: mapId('employees', p.employeeId), created_at: p.$createdAt,
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(created.user.id);
    throw new Error(`user_profiles (${awUser.email}): ${profileErr.message}`);
  }
  if (tempPassword) tempPasswords.push(`${awUser.email},${tempPassword}`);
  usersCreated++;
  console.log(`  ✅ ${awUser.email} (${p.role})${tempPassword ? ' — temporary password issued' : ''}`);
}

if (tempPasswords.length) {
  writeFileSync(CREDENTIALS_FILE, `email,temporary_password\n${tempPasswords.join('\n')}\n`, { mode: 0o600 });
  console.log(`\n🔑 ${tempPasswords.length} temporary password(s) written to ${CREDENTIALS_FILE} — share securely, then delete the file.`);
}

console.log(`\n${DRY_RUN ? '🔎 Dry run complete' : `✅ Done — ${usersCreated} user(s) migrated`}${skipped ? `, ${skipped} record(s) skipped (see warnings)` : ''}.`);
