# TimeSync Scheduling — Platform Audit

**Date:** October 25, 2026 · **Scope:** the whole repository at commit `3de1944` (before the Supabase migration), plus the Supabase migration delivered alongside this report.

Findings are labeled **Fixed** (resolved by the Supabase migration in this change) or **Open** (still to do). Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low.

---

## 1. Summary

TimeSync is a Next.js 14 web app (`apps/web`) for scheduling staff: a week/day/month/timeline calendar, employee records with weekly availability, locations, time-off approvals, a configurable rule engine, seasons with shift templates that bulk-generate shifts, reports and analytics, and an AI Copilot (Claude) that can read and assign shifts. Until this change all data and logins lived in **Appwrite**.

The UI is broad and mostly wired to real data. The main problems were in **security** and in **features that look finished but aren't**:

| Area | Verdict |
|---|---|
| Multi-tenant data isolation | 🔴 **Broken on Appwrite** — any signed-in user could read, change, or delete every organization's data. **Fixed** with Postgres Row Level Security. |
| AI Copilot endpoint | 🔴 **Unauthenticated** — anyone on the internet could read any org's staff list, create or reassign shifts, and spend your Anthropic credits. **Fixed.** |
| Role security | 🔴 Any user could make themselves an admin of any organization. **Fixed.** |
| Core scheduling | 🟠 Shift CRUD works; "Generate schedule" and "Publish" are simulated; no UI to assign people to shifts; staff "My Schedule" is always empty. **Open.** |
| Data consistency | 🟠 Departments and org name live in the browser's localStorage, not the database. **Open.** |
| Dependencies | 🔴 Next.js 14.2.0 has published critical advisories; 13 production advisories total, mostly from unused packages. **Open.** |
| Engineering health | 🟡 No tests or CI; README describes a backend (`apps/api`, `apps/scheduler`) that is not built or deployed. **Open.** |

---

## 2. Security findings

### 🔴 S1 — AI Copilot API was open to the internet · **Fixed**
`app/api/copilot/route.ts` accepted any POST without checking who sent it, then queried Appwrite with the **server's admin API key** using the `orgId` supplied in the request body. Anyone who knew or guessed an org id could list employees and their availability, create shifts, and assign or unassign staff in that org — and every call spent Anthropic API credits. The org id was also interpolated straight into Appwrite query strings (`Query.equal("orgId","${orgId}")`), allowing query injection.

**Now:** the route requires the caller's Supabase session token, derives the organization from the caller's profile (the request body can no longer name one), and runs every tool query *as the caller*, so Row Level Security applies — staff can't make writes through the AI, and no one can reach another org. The admin key is no longer used here at all.

### 🔴 S2 — No tenant isolation in the database · **Fixed**
Every Appwrite collection and document was created with `Permission.read/update/delete(Role.users())`, meaning **any authenticated user in the project** — including a staff member of a different organization, or anyone who signed up through `/setup-admin` — could read every org's employees (pay rates, phone numbers, emails), time-off reasons, and schedules, and modify or delete them. The `orgId` filters in `lib/db.ts` were only a UI convenience, not enforcement.

**Now:** every table has Row Level Security. Members see only their own organization; only admins write; staff see only shared schedule data plus their own records. Verified against Postgres 16 with cross-org read/write attempts, staff self-promotion, staff self-approving time off, and anonymous access — all rejected (details in §6).

### 🔴 S3 — Anyone could become an admin of any organization · **Fixed**
`user_profiles` was writable by any signed-in user, and the app trusts `role` from that table. Creating or editing a profile document with `role: 'admin'` and another org's id granted full admin access there.

**Now:** profiles can only be created by the `bootstrap_organization()` database function (for a brand-new org's first admin) or by the server-side invite route after it verifies the caller is an admin. Staff cannot edit their own profile.

### 🟠 S4 — Staff accounts were created from the browser · **Fixed**
`inviteUser()` called Appwrite's `account.create` from the admin's browser and then wrote the profile client-side, relying on the open permissions above. It also never linked the new login to an employee record.

**Now:** `POST /api/admin/users` verifies the caller is an admin, creates the login with the Supabase secret key, links an optional employee (checked to belong to the same org), and rolls back the login if the profile insert fails. *(Linking from the Settings form UI is still to do — see F2.)*

### 🟡 S5 — Script injection through "Export PDF" · **Open**
`exportSchedulePDF()` (`app/schedule/page.tsx`) writes shift titles, department, location, and employee names into a new same-origin window with `document.write` without escaping. A shift titled `<img src=x onerror=…>` runs script in the TimeSync origin when another admin exports, and can read the Supabase session from localStorage. Requires write access to the same org, so it's an insider risk. **Fix:** HTML-escape every interpolated value (a 5-line `escapeHtml` helper).

### 🔴 S6 — Vulnerable dependencies · **Open**
`npm audit --omit=dev`: 2 critical, 10 high, 1 moderate.
- **`next@14.2.0`** — critical advisories (cache poisoning, image-optimizer DoS, and the December 2025 security release). Upgrade to **`14.2.35`** (same minor line, low risk).
- Most of the rest come from packages the app **never imports**: `next-auth` (critical), `axios`, `socket.io-client` (→ `engine.io`, `ws`). Removing them clears them.
- `zod` (high: memory exhaustion on oversized constrained collections) — now used by the invite route, whose schema has no collections; still worth bumping.

### 🟡 S7 — Open self-service signup · **Open**
`/setup-admin` lets anyone create an organization ("This page only works once" in its footer is not true). That's reasonable for a SaaS signup, but turn on **Supabase Auth → Attack Protection → CAPTCHA** and keep the default rate limits, or restrict signup if TimeSync is single-customer.

### ⚪ S8 — Minor · **Open**
- `/settings` has no `AuthGuard` (it only shows placeholder data, and the invite call is server-checked, so nothing leaks).
- Route guards are client-side only. With RLS this is acceptable — the database is the enforcement point — but a `middleware.ts` redirect would avoid flashing protected pages.
- The Appwrite project id was hard-coded as a fallback in source (removed).

---

## 3. Functional bugs and gaps (all **Open**)

### 🟠 F1 — Two sources of truth: browser vs database
The onboarding wizard (`/onboarding`) saves the org, departments, locations, and staff to **localStorage only** (`lib/org-store.ts`). Meanwhile the real org is created in the database by `/setup-admin`. Consequences:
- **Departments never reach the database** — `createDepartment()` is never called. Every department dropdown (add/edit employee, new shift, shift templates) reads the current browser's localStorage, so a second admin, a new laptop, or cleared storage shows no departments, and saved `departmentId` values are meaningless ids like `dept-1712…`. (The new schema stores department ids as text for this reason.)
- The org name on the schedule header and PDF comes from localStorage.
- The edit-shift modal uses **mock** departments/locations (`mockDepartments`, `mockLocations`).

**Fix:** make onboarding write to the database (orgs, departments, locations, employees via `lib/db.ts`), replace `loadSetup()` reads with `getDepartments()`/`getLocations()`/`getOrg()`, then switch `department_id`/`location_id` to real foreign keys.

### 🟠 F2 — No way to assign staff to shifts; "My Schedule" is always empty
- The calendar has no "assign employee" control. The only writer of shift assignments is the AI Copilot's `assign_shift` tool. `shift_assignments` (table) and `assignEmployee()` exist but are unused.
- `docToShift()` drops `assignedEmployeeIds/Names` (`assignments: []`), so week/day/month views and the detail panel never show who is working (only the staff timeline reads names).
- Staff see shifts where `assignedEmployeeIds` contains their `profile.employeeId` — but invited users are never linked to an employee, so the list is always empty.

**Fix:** add an employee picker to the shift detail panel; map assignments in `docToShift`; add an "employee" dropdown to the invite form (the API already accepts `employeeId`).

### 🟠 F3 — "Generate schedule" and "Publish" are simulated
`handleGenerate()` waits 3.5 s and flips a local status; `handlePublish()` sets local state on `mockSchedule`. Nothing is saved, nothing is optimized, and staff are not notified. The Python OR-Tools scheduler in `apps/scheduler` is not deployed or called. **Fix:** persist schedules (`schedules` table already exists), and either deploy the solver or have the Copilot's tools do greedy assignment against the rules.

### 🟡 F4 — Month view shows only one week
The schedule page fetches shifts for the current *week* only and passes them to every view, so Month view is mostly empty. Fetch the visible month's range when `view === 'month'`.

### 🟡 F5 — Dates shift by a day around midnight / outside the US
`new Date().toISOString().split('T')[0]` (10 occurrences) returns the **UTC** date, so "today" is tomorrow for US users in the evening. Calendar navigation and the season shift generator use the same pattern; for organizations east of UTC the generator creates every shift **one day early**. Use `date-fns` `format(d, 'yyyy-MM-dd')` (already a dependency).

### 🟡 F6 — Edits that don't save
- **Settings → Save** only shows a "saved" tick; nothing persists. It also displays a hard-coded mock org ("metro-general"). `updateOrg()` exists but is unused.
- **Edit shift** persists title/date/times/color/notes/status only; department, location, staffing levels, and type changes are lost on reload.

### 🟡 F7 — Season generator duplicates shifts
Running "Generate Shifts" twice for the same range creates every shift twice, one insert at a time. Check for existing shifts in the range (or add a `template_id` + unique `(template_id, date)` constraint) and insert in one batch.

### ⚪ F8 — Smaller issues
- "Remove" employee says it will *deactivate* the account but hard-deletes the record (`is_active` already exists for soft-delete).
- Every loaded shift shows a duration of 8 h in the detail panel (`durationHours: 8` hard-coded in `docToShift`).
- Login always routes to `/schedule`; staff bounce through to `/my-schedule`.
- Opening the Rules page for an org with no rules seeds defaults; two admins doing so at once get duplicates.
- New admins were bounced to `/login` after setup because auth state wasn't refreshed (**Fixed** in this change).

---

## 4. AI Copilot

Works end-to-end with real tool use. Beyond S1 (fixed):
- **Model:** `claude-sonnet-4-6` is a previous-generation model. Current options are `claude-sonnet-5-5` (same tier) or `claude-opus-5-5` (most capable default). Switching is a product/cost decision, so it's left unchanged.
- **Loop correctness:** text Claude writes alongside tool calls is discarded; if the 6-round limit is hit mid-tool-use the user gets no answer; `max_tokens` and `refusal` stop reasons aren't handled; tool inputs aren't validated.
- **"Streaming" is simulated** — the full reply is generated, then split into 3-word chunks with an 8 ms delay. Real streaming (`messages.stream`) would cut perceived latency substantially.
- The browser sends employee pay rates and the full rule set into the prompt on every message; the server could load these itself now that it knows the caller's org.

---

## 5. Code and project health (all **Open**)

- **README overstates the product.** It describes a Fastify + Prisma API, Redis, BullMQ, OR-Tools solver, WebSocket collaboration, drag-and-drop, and payroll/Slack integrations. In reality: `apps/api/src/index.ts` imports ~10 files that don't exist and has no `package.json`; `apps/scheduler/main.py` isn't deployed; `@dnd-kit`, `socket.io-client`, React Query, and react-hook-form are installed but unused; undo/redo stacks exist in the store but aren't wired to any button. Recommend trimming the README to what ships, and deleting or clearly marking `apps/api` as a prototype.
- **No tests, no CI.** Even a GitHub Action running `tsc --noEmit` + `next build` on pull requests would catch most regressions; RLS policies deserve SQL tests (the checks used in §6 are a good start).
- **13 unused production dependencies:** `next-auth`, `socket.io-client`, `axios`, `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `cmdk`, `vaul`, `framer-motion`, `react-hot-toast`, `@dnd-kit/core` (+ `sortable`, `utilities`). Removing them shrinks installs and clears most of S6.
- **Loose typing:** most pages hold records as `any`. Generating types from the schema (`npx supabase gen types typescript`) and typing `lib/db.ts` returns would catch field-name mistakes at compile time.
- `lib/mock-data.ts` (360 lines) still feeds the schedule status, settings page, copilot page org, and rule defaults.

---

## 6. Supabase migration — what changed

| Before (Appwrite) | After (Supabase) |
|---|---|
| 13 collections created by `scripts/setup-appwrite.mjs` | 13 tables in `supabase/migrations/` (`…_init.sql`, `…_harden_helpers.sql`), with foreign keys, check constraints, indexes, `updated_at` triggers |
| Permissions: any signed-in user, all data | Row Level Security per organization and role |
| JSON stored as strings (`parameters`, `hoursJson`, `weeklyAvailability`, `daysOfWeek`) | Native `jsonb` / arrays — readable and queryable in the dashboard |
| Browser-side user creation | Server route `/api/admin/users` (admin-checked) |
| Copilot with admin API key, no auth | Copilot acts as the signed-in user |
| `appwrite`, `node-appwrite` in the web app | `@supabase/supabase-js`; `node-appwrite` kept only as a root dev dependency for the one-time data copy script |

**Files:** `lib/supabase.ts` (browser client + row mapping), `lib/supabase-server.ts` (session check for API routes), `lib/db.ts` and `lib/auth.ts` (same function names as before, so pages barely changed), `app/api/admin/users/route.ts`, `scripts/migrate-appwrite-to-supabase.mjs`, `docs/SUPABASE_SETUP.md`, `apps/web/.env.example`.

**Verification performed:**
- Schema applied cleanly to PostgreSQL 16 (with a stub of Supabase's `auth` schema).
- RLS checks: a second org sees 0 of the first org's rows; inserting into, updating, or deleting another org's rows fails; creating an admin profile in another org fails; staff can read shifts but only their own employee row; staff can't create shifts, can file their own pending time-off, can't self-approve or promote themselves; the `anon` role is denied.
- Data-copy script run against mocked Appwrite data (150 employees across two pages, orphaned records, both hash types), then its output loaded into the real schema: all rows accepted; ids remapped consistently; assignments to deleted employees dropped with names kept in step; Argon2 hashes passed through for password-preserving import.
- `tsc --noEmit` and `next build` pass with no environment variables set.
- Applied to the live `TimeSync` Supabase project; Supabase's security advisor reports one intentional warning (`bootstrap_organization` is callable by signed-in users — it is the signup call and refuses anyone who already has an org).
- **Not yet verified:** the RLS checks against the live project, and a run of the data-copy script against your real Appwrite data (needs your keys). Do the `--dry-run` first.

### Cut-over checklist
1. ~~Create a Supabase project and apply the migrations~~ — done (`TimeSync`, ref `mnugebtlenlnkiinsyhn`).
2. Configure Auth (§2) and set the four env vars locally and in Vercel (§3).
3. Run the data copy with `--dry-run`, then for real (§4).
4. Deploy; sign in as an existing admin to confirm data and login.
5. Remove the `NEXT_PUBLIC_APPWRITE_*` / `APPWRITE_API_KEY` env vars from Vercel, then shut down the Appwrite project once you're satisfied.

---

## 7. Recommended next steps (in order)

1. **Cut over to Supabase** (checklist above) — closes S1–S4.
2. **Upgrade Next.js to 14.2.35 and remove unused packages** (S6) — small, high-value.
3. **Escape the PDF export** (S5).
4. **Move onboarding data into the database** (F1) — unblocks multi-admin use.
5. **Shift assignment UI + employee linking on invite** (F2) — makes the staff experience work at all.
6. **Fix UTC date handling** (F5) and the month view range (F4).
7. Persist schedule status/publish (F3); make Settings save (F6).
8. Add CI (type-check + build) and a small RLS test suite.
9. Decide on the Copilot model upgrade and switch to real streaming (§4).
