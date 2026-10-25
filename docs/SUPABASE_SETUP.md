# Running TimeSync on Supabase

TimeSync's backend (auth + database) runs on Supabase. This replaces the earlier
Appwrite setup. Everything you manage day to day — users, organizations, shifts,
employees, rules — lives in the Supabase dashboard under **Table Editor** and
**Authentication → Users**.

## 1. Create the database schema

> **Already done for the `TimeSync` project** (ref `mnugebtlenlnkiinsyhn`, us-east-1,
> organization "Kaizen Koding"). Both migrations below are applied. Repeat this step
> only for a new project (for example a staging copy).

The whole schema lives in [`supabase/migrations/`](../supabase/migrations), applied in
filename order:

| File | What it does |
|---|---|
| `20261025022713_init.sql` | 13 tables, helper functions, Row Level Security policies |
| `20261025022820_harden_helpers.sql` | Moves the RLS helper functions into a `private` schema (out of the public API) and adds three foreign-key indexes |

Apply them to a new project either way:

- **Dashboard:** **SQL Editor → New query**, paste each file in order, and run it.
- **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`.

The filenames match the versions recorded in the live project, so `db push` against
`TimeSync` only applies migrations added after these.

## 2. Configure Auth

In **Authentication → Sign In / Providers → Email**:

- Keep **Email** enabled and **Allow new users to sign up** on (the `/setup-admin`
  page signs up the first admin of each organization).
- **Confirm email** can be on or off. With it on, a new admin is asked to click the
  emailed link and then sign in; their organization is created on that first sign-in.
  If you leave it on, set **Authentication → URL Configuration → Site URL** to your
  deployed URL so the confirmation link points to the right place.

Staff accounts created by an admin from **Settings → Users & Access** are confirmed
automatically.

In **Authentication → URL Configuration** (needed for "Forgot your password?" and
email confirmation links):

- **Site URL:** your deployed address, e.g. `https://your-app.vercel.app`
- **Redirect URLs:** add `https://your-app.vercel.app/**` and, for local development,
  `http://localhost:3000/**`. Supabase refuses to send people anywhere not on this list.

**Email delivery:** Supabase's built-in email sender only delivers to members of your
Supabase organization and is limited to a few emails per hour. That's enough to test
password resets on your own account. Before staff use "Forgot your password?", connect
your own email provider under **Authentication → Emails → SMTP Settings** (Resend,
SendGrid, Postmark, or similar).

## 3. Set environment variables

Copy `apps/web/.env.example` to `apps/web/.env.local` for local development, and add
the same variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (older projects: `anon` key, also accepted as `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Yes |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key (older projects: `service_role`, also accepted as `SUPABASE_SERVICE_ROLE_KEY`) | **No — server only** |
| `ANTHROPIC_API_KEY` | console.anthropic.com | **No — server only** |

The secret key bypasses Row Level Security. It is only read by the server route that
creates staff logins (`/api/admin/users`), which first checks the caller is an admin.

You can remove the old `NEXT_PUBLIC_APPWRITE_*` and `APPWRITE_API_KEY` variables
from Vercel once you've switched over.

## 4. Copy existing data from Appwrite (optional, one time)

If you have real data in Appwrite, copy it into the **empty** Supabase project after
step 1. From the repository root:

```bash
npm install

# Preview what will be copied — writes nothing
APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1 \
APPWRITE_PROJECT_ID=<appwrite project id> \
APPWRITE_API_KEY=<key with databases.read + users.read scopes> \
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SECRET_KEY=<secret key> \
node scripts/migrate-appwrite-to-supabase.mjs --dry-run

# Then run it for real (same variables, without --dry-run)
```

What it does:

- Copies every collection into the matching table, giving each record a new UUID
  and rewriting every cross-reference (shift → employee, template → season, …).
- Recreates each Appwrite login that has a TimeSync profile. Users **keep their
  existing password** — Appwrite's Argon2 hashes are imported directly. Any user
  whose hash can't be imported gets a random temporary password, written to
  `appwrite-migration-credentials.csv` (git-ignored; share it securely, then delete it).
- Skips and reports records that point at nothing (for example shifts saved with the
  placeholder org id `local`).

## Managing users by hand (SQL Editor)

Ready-made scripts live in [`supabase/snippets/`](../supabase/snippets). Paste one into
**SQL Editor → New query** and click **Run**.

| Script | What it does |
|---|---|
| `01_remove_all_users.sql` | Deletes **every** login and all organization data. Cannot be undone. |
| `02_make_me_admin.sql` | Creates an organization and makes an existing login its admin. Create the login first under **Authentication → Users → Add user** (tick **Auto Confirm User**), then edit the email/name values at the top of the script. |

The easier alternative to `02` is the app's own `/setup-admin` page, which creates the
login, the organization, and the admin profile in one step.

**Forgotten passwords:** the login page has a "Forgot your password?" link. It emails a
link to `/reset-password`, where the user picks a new password (requires the URL
Configuration and email setup from step 2).

## How access control works

Postgres enforces who can see what, so a bug in the frontend can't leak another
organization's data:

| Who | Can read | Can write |
|---|---|---|
| Admin | Everything in their own organization | Everything in their own organization |
| Staff | Their org's shifts, schedules, seasons, templates, departments, locations; their own employee record, time-off requests and availability overrides | New *pending* time-off requests for themselves |
| Anyone else | Nothing | Nothing |

A user's organization and role come from their row in `user_profiles`. To change
someone's role, edit that row in the Table Editor. To remove someone's access, delete
their user under **Authentication → Users** (their profile is deleted with it).

## Making schema changes

Add a new file under `supabase/migrations/` (e.g. `20261101000000_add_breaks.sql`) rather
than editing the existing one, then apply it the same way as step 1. New tables need
`alter table … enable row level security` and policies, or the app won't be able to
read them.
