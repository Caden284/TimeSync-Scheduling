# TimeSync Scheduling — Full Audit: What to Improve

**Date:** October 25, 2026 · **Covers:** the whole web app (`apps/web`), its database, the AI Copilot, and the project setup.

Each item says what's wrong in plain terms, why it matters, and what to do. Priority: 🔴 do first · 🟠 important · 🟡 worthwhile · ⚪ polish.

---

## 1. Where things stand

TimeSync already has a lot of surface area: week, day, month, and timeline calendars; employees with weekly availability; locations; time-off approvals; a rule engine; seasons with shift templates that generate shifts in bulk; reports and charts; and an AI Copilot that can read and assign shifts. Most screens read and write real data.

The gap is between **what the app looks like it does** and **what it actually does**. Several headline features are visual only, and the people who'd use it most — staff — have almost nothing that works for them yet.

| Area | Before → After (Oct 28 update) |
|---|---|
| Security | **F → A−** — tenant isolation, open AI endpoint, admin self-promotion, PDF injection, and all dependency advisories fixed (`npm audit`: 0). |
| Core scheduling | **C− → A−** — pre-set schedules (task slots per season), worker types and task eligibility, Auto-Schedule that respects all of it, real Publish. |
| Rule engine | **D → A−** — hours, rest, consecutive days, overtime, staffing, availability, time off, task eligibility, and breaks; rules can target a worker type; unit-tested. |
| Staff experience | **F → B+** — published schedule, coworkers, notifications, time off, availability, open-shift pickup, give-away requests, calendar feed. No coworker-to-coworker swaps yet. |
| Phone / tablet use | **D → B** — slide-out menu, full-screen panels on phones, installable to the home screen. |
| Trustworthiness of the UI | **D → A−** — demo data and decorative controls removed; notifications are real. |
| Engineering health | **C → B+** — Next.js 15.5 / React 19, dead apps removed, README matches what ships, CI runs type-check, unit tests, build, and database access-rule tests. |

---|---|
| Security | **F → A−** — tenant isolation, open AI endpoint, admin self-promotion, PDF injection, and all dependency advisories fixed (`npm audit`: 0). |
| Core scheduling | **C− → B+** — assign/remove staff with conflict checks, Auto-Schedule, real Publish. |
| Rule engine | **D → B+** — hours, rest, consecutive days, overtime, staffing, availability, and time off are enforced; rule types that need missing data are labeled. |
| Staff experience | **F → B−** — published schedule, coworkers, notifications, time-off requests, availability. No swaps or open-shift pickup yet. |
| Phone / tablet use | **D → C** — My Schedule works on phones; admin pages are still desktop-first. |
| Trustworthiness of the UI | **D → A−** — demo data and decorative controls removed; notifications are real. |
| Engineering health | **C → B−** — Next.js 15.5 / React 19, unused packages gone; still no automated tests or CI. |

---

## 2. Fix first — things that are broken or misleading

### 🔴 2.1 You can't assign people to shifts
There's no "assign employee" control anywhere in the calendar. The only thing that can put a person on a shift is the AI Copilot. Even when the AI does assign someone, the week/day/month views don't show who's working (only the Staff Timeline does), because the loaded shift data throws the assignment away.

**Do:** add an employee picker to the shift detail panel ("+ Assign"), and show assigned names on shift cards in every view.
*Technical:* `docToShift()` in `app/schedule/page.tsx` sets `assignments: []` and ignores `assignedEmployeeIds/Names`.

### 🔴 2.2 Staff see an empty "My Schedule"
A staff member's schedule shows shifts assigned to *their employee record* — but when an admin creates a staff login (Settings → Users & Access), nothing links that login to an employee. So every staff member sees "No shifts scheduled", forever.

**Do:** add an "Which employee is this?" dropdown to the create-user form (the server already supports it), and a way to link existing logins.

### 🔴 2.3 The Rule Engine doesn't enforce anything
Admins can create rules like "max 40 hours/week" or "10 hours rest between shifts", but nothing checks them when a shift is created, edited, or assigned. Approved time off and employee availability are also ignored. Only the AI Copilot reads the rules, as suggestions in its instructions.

**Do:** when assigning someone, check for conflicts and warn inline: *double-booked · on approved time off · outside availability · would exceed weekly hours · not enough rest*. Hard rules block; soft rules warn. This is the feature that makes the rule engine real — and it's the main reason people pay for scheduling software.

### 🟠 2.4 "Generate schedule" and "Publish" are simulated
"Generate" shows a spinner for 3.5 seconds and changes a label. "Publish" changes a label. Nothing is saved, nothing is optimized, nobody is notified, and the status resets when you reload.

**Do (short term):** save schedule status in the database (the `schedules` table already exists) and have "Publish" make shifts visible to staff. **Do (later):** make "Generate" real — either have the AI Copilot fill open shifts using its tools plus the conflict checks from 2.3, or deploy the optimization engine in `apps/scheduler` (currently not running anywhere).

### 🟠 2.5 Departments only exist in one browser
The onboarding wizard saves your organization, departments, locations, and starter staff to the **browser's local storage**, not the database. So a second admin — or you on a different computer, or after clearing your browser — sees no departments in any dropdown. The edit-shift form uses **made-up demo** departments and locations.

**Do:** have onboarding save to the database, and make every dropdown read departments/locations from it.

### 🟠 2.6 Fake or placeholder content
- **Notifications bell** shows four hard-coded alerts ("Week of Jul 19 is now visible to staff", "Jordan S. time-off request was approved", …). None are real.
- **Settings → Save** shows a checkmark but saves nothing, and the page displays the demo organization "Metro General Hospital" (slug `metro-general`).
- **The AI Copilot is told it works for "Metro General Hospital"** after you open the Employees, Settings, or Copilot page, because those pages load the demo organization.
- The schedule header and PDF export take your org name from the browser, not the database.

**Do:** remove the demo data (`lib/mock-data.ts`), load the real organization from the database everywhere, make Settings save, and either wire notifications to real events or hide the bell until they are.

### 🟡 2.7 Calendar and date bugs
- **Month view shows only one week** of shifts — it reuses the week's data.
- **"Today" is wrong in the evening** for US users (the app uses the UTC date, which flips at 7–8 pm Eastern). For organizations east of UTC, "Generate shifts from templates" creates every shift **one day early**.
- Every shift's detail panel says it's **8 hours long**, whatever its real times.
- Editing a shift only saves title, date, times, color, notes, and status — changes to department, location, staffing levels, or type are lost on reload.
- Running "Generate shifts" for a season twice creates **every shift twice**.
- Clicking "Remove" on an employee says it will deactivate them but **permanently deletes** them.

---

## 3. Staff experience — the biggest product gap

Right now TimeSync is an admin tool. Competing products (When I Work, Deputy, Homebase, LibStaffer) win on the staff side, because that's what keeps managers from fielding texts and phone calls. Staff currently can only view an (empty) week of their own shifts.

What staff should be able to do, in rough order of value:

1. **See their schedule** — fix 2.1/2.2, then add a list view of upcoming shifts and the ability to see who else is working.
2. **Request time off** — the database already allows it (staff can file their own *pending* requests), but the Time Off page is admin-only. Add a simple request form to My Schedule.
3. **Set their own availability** — today only admins can edit it.
4. **Pick up open shifts** — a list of unfilled shifts staff can claim (with admin approval if you like).
5. **Swap or give away shifts** — request a trade with a coworker; admin approves.
6. **Get notified** — email (and later text/push) when a schedule is published or their shift changes.
7. **Add shifts to their phone calendar** — a personal calendar link (iCal feed) that Google/Apple Calendar can subscribe to.

---

## 4. Phones, tablets, and accessibility

### 🟠 4.1 Not usable on a phone
Only 11 of 44 screen components adapt to small screens. Every admin page uses a fixed sidebar (240 px, or 64 px collapsed) with no mobile menu, side panels are fixed at 320 px, and "My Schedule" forces a 7-column grid — on a phone, each day column is about 40 px wide. Staff are the most likely to open the app on a phone.

**Do:** start with **My Schedule** (stack days vertically on small screens), then add a slide-out menu for the sidebar and full-screen modals/panels below ~768 px. Consider making it installable to the home screen (a PWA).

### 🟡 4.2 Accessibility
- **Icon-only buttons have no labels** — there's exactly one `aria-label` in the whole app. Screen readers announce the close (✕), edit (✎), notification, and toggle buttons as just "button".
- **Custom toggle switches** (availability days, rules on/off) don't tell assistive tech whether they're on or off.
- **Native browser pop-ups** (`confirm()`/`alert()`, 6 places) for deletes and errors look out of place and can't be styled; the app already has a modal component to use instead.
- Light-gray small text on white (e.g. `text-gray-400` at 10–12 px) is below recommended contrast in several places.

If you sell to libraries, universities, hospitals, or government, accessibility (WCAG 2.1 AA) is often a purchasing requirement.

---

## 5. Security — remaining items

The critical issues are fixed (see §8). What's left:

### 🔴 5.1 Outdated Next.js with known vulnerabilities
The app runs Next.js **14.2.0**, which has published critical security advisories. Upgrading to **14.2.35** is a same-line patch upgrade with low risk. `npm audit` also flags 12 other issues, mostly from packages the app doesn't even use (`next-auth`, `axios`, `socket.io-client`) — removing them clears them.

### 🟡 5.2 PDF export can run injected code
"Export PDF" writes shift titles and names into a new window without escaping them. Someone with admin access to your organization could title a shift with hidden code that runs when another admin exports. **Do:** escape the text (a five-line fix).

### 🟡 5.3 Anyone can create an organization
The `/setup-admin` page is open to the public (its footer says "This page only works once", which isn't true). Fine for a self-serve product, but turn on **CAPTCHA** in Supabase (Authentication → Attack Protection) to stop bots — or restrict sign-up if TimeSync is for your organization only.

### ⚪ 5.4 Smaller items
- `/settings` doesn't check that you're signed in before showing (it only shows demo data, so nothing leaks).
- Pages briefly render before redirecting signed-out users; a server-side redirect (`middleware.ts`) would avoid that flash.
- Password-reset emails use Supabase's built-in sender, which only reaches your own Supabase team and a few emails per hour. Connect an email provider before staff rely on "Forgot your password?".

---

## 6. AI Copilot

It works end-to-end with real database tools, which is a genuine strength. To make it better:

- **Use a current model.** It runs `claude-sonnet-4-6`, a previous generation. `claude-sonnet-5-5` is the current model in the same tier; `claude-opus-5-5` is the most capable. (A cost decision for you.)
- **Real streaming.** Today it waits for the whole answer, then fakes typing by revealing three words every 8 ms. Streaming the real response would make it feel much faster.
- **Don't lose its answers.** If the AI writes text alongside a tool call, that text is dropped; if it hits its 6-step limit mid-task, you get no reply at all. Cut-off and refusal cases aren't handled.
- **Have it respect the rules.** Once conflict checks exist (2.3), run the AI's assignments through them so it can't book someone on approved time off.
- **Load context on the server.** The browser currently sends employee pay rates and all rules with every message; the server can load them itself now that it knows who's asking.

---

## 7. Engineering health

- **No automated tests and no CI.** A GitHub Action that type-checks and builds every pull request would catch most mistakes before they reach users. The database access rules deserve their own tests (the checks used during the Supabase migration are a ready-made start).
- **13 unused packages** (`next-auth`, `socket.io-client`, `axios`, React Query, React Table, react-hook-form, `cmdk`, `vaul`, `framer-motion`, `react-hot-toast`, drag-and-drop kit, …). They slow installs and carry most of the security warnings.
- **The README describes things that don't exist** — a Fastify/Prisma API, Redis, WebSocket collaboration, drag-and-drop, payroll and Slack integrations. `apps/api` imports about ten files that aren't there, and `apps/scheduler` isn't deployed. Trim the README to what ships so expectations match reality.
- **Loose typing.** Most pages treat records as `any`, so a misspelled field name isn't caught until it breaks on screen. Generate types from the database (`npx supabase gen types typescript`) and use them in `lib/db.ts`.
- **Half-built features in the code:** undo/redo is stored but has no buttons; a command palette is wired in state but never rendered.

---

## 8. Already fixed in this round

| Problem | Status |
|---|---|
| Any signed-in user could read, change, or delete **every organization's** data (Appwrite permissions) | ✅ Fixed — moved to Supabase with database-enforced access rules per organization and role |
| AI Copilot endpoint was **open to the internet**, used an admin key, and trusted whatever organization the request named | ✅ Fixed — requires sign-in and only acts on the caller's own organization |
| Anyone could make themselves **admin** of any organization | ✅ Fixed |
| Staff logins were created from the browser | ✅ Fixed — created by an admin-checked server route |
| New admins were bounced to the login page after setup | ✅ Fixed |
| No way to reset a forgotten password | ✅ Added — "Forgot your password?" on the login page |
| Hard-coded Appwrite project ID in the source | ✅ Removed |
| Outdated Next.js with critical advisories (5.1) | ✅ Next.js 15.5.28 + React 19; 25 unused packages removed; `npm audit` reports 0 |
| No way to assign people to shifts (2.1) | ✅ Assign/remove from the shift panel; names show in every view |
| Staff see an empty My Schedule (2.2) | ✅ Logins link to employee records (Settings → Users & Access) |
| Rule engine enforces nothing (2.3) | ✅ Conflict checks in the picker, Auto-Schedule, and the AI Copilot |
| Fake Generate/Publish (2.4) | ✅ Auto-Schedule with preview; per-week publish that controls what staff see |
| Departments only in one browser (2.5) | ✅ Onboarding, departments, and org settings stored in the database |
| Fake notifications, demo org, Settings doesn't save (2.6) | ✅ Real notifications (database triggers + live updates); demo data removed |
| Month view, UTC dates, 8-hour durations, lost edits, duplicate generation, hard delete (2.7) | ✅ All fixed |
| PDF export injection (5.2) | ✅ Escaped |
| Staff can't request time off or set availability (§3 items 2–3) | ✅ On My Schedule |
| Copilot loop drops text / no reply at step limit; told it works for a demo hospital (§6) | ✅ Fixed; context loads from the database |
| Copilot on a previous-generation model, fake typing (§6) | ✅ Claude Opus 5.5 with real streaming, explicit effort, validated tool inputs, and server-side refusal fallback; can fill a whole week through the same planner as Auto-Schedule |
| Staff can't pick up open shifts or give shifts away (§3 items 4–5) | ✅ Open-shift pickup (every rule re-checked on the server) and give-away requests that admins approve on Time Off → Shift give-aways. Coworker-to-coworker swaps are still to do. |
| No calendar feed (§3 item 7) | ✅ Private iCal link on My Schedule (Google, Apple, Outlook), replaceable at any time |
| Admin pages unusable on a phone (4.1) | ✅ Slide-out menu, wrapping toolbars, full-screen shift panel and Copilot, phone layouts for Settings and Seasons, home-screen install (web app manifest) |
| Accessibility (4.2) | ✅ Labels on icon-only buttons, switches announce on/off, `confirm()` pop-ups replaced with an in-app dialog, dialogs close with Escape and manage focus. Low-contrast small text still needs a pass. |
| No tests or CI; dead `apps/api` and `apps/scheduler`; README describes things that don't exist (§7) | ✅ Rule-engine unit tests and database access-rule tests run in GitHub Actions with type-check and build; dead apps and the stale API spec removed; README rewritten; unused store state (undo/redo, command palette) removed |
| No browser icon | ✅ Favicon, app icon, and home-screen icon |

**Still open** (outside the code, or next up): turn on CAPTCHA and leaked-password protection in the Supabase dashboard (5.3); connect an email provider before relying on password-reset or email notifications (5.4); coworker-to-coworker swaps; email/push notifications; a contrast pass on small gray text; generated database types (§7); a server-side sign-in redirect (5.4, needs cookie-based sessions).

Supabase project **TimeSync** (`mnugebtlenlnkiinsyhn`, us-east-1) is live with the schema applied. Supabase's security checker reports one intentional warning (the sign-up function is callable by signed-in users by design). Setup steps: [`docs/SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

---

## 9. Recommended order

**This week — make what's there honest and safe**
1. Upgrade Next.js to 14.2.35 and remove unused packages (5.1, §7).
2. Remove demo data: real org name everywhere, Settings saves, hide or wire up notifications (2.6).
3. Escape the PDF export (5.2) and fix the date bugs (2.7).

**Next — make scheduling actually work**
4. Assign employees to shifts and show who's working (2.1).
5. Link staff logins to employees (2.2).
6. Conflict checks: time off, availability, double-booking, hours, rest (2.3).
7. Save departments/onboarding to the database (2.5).
8. Real Publish, then a real Generate (2.4).

**Then — win on the staff side**
9. Mobile-friendly My Schedule (4.1).
10. Staff time-off requests and availability (§3).
11. Open-shift pickup, swaps, and publish notifications (§3).

**Ongoing**
12. CI with type-check, build, and access-rule tests (§7).
13. Copilot: current model, real streaming, rule-aware assignments (§6).
14. Accessibility pass (4.2).
