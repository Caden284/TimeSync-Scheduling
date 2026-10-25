# Running TimeSync on Supabase

TimeSync's backend (auth + database) runs on Supabase. This replaces the earlier
Appwrite setup. Everything you manage day to day — users, organizations, shifts,
employees, rules — lives in the Supabase dashboard under **Table Editor** and
**Authentication → Users**.

## 1. Create the database schema

The whole schema lives in [`supabase/migrations/`](../supabase/migrations). Apply it
once to a new Supabase project, either way:

- **Dashboard:** open **SQL Editor → New query**, paste the contents of
  `supabase/migrations/20261025000000_init.sql`, and run it.
- **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`.

This creates 13 tables, the helper functions, and Row Level Security policies.

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
