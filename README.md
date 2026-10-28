# TimeSync Scheduling

AI workforce scheduling for organizations with shift-based staff — libraries, universities,
hospitals, restaurants, warehouses, and more.

## What it does

| Feature | Description |
|---------|-------------|
| Pre-set schedules | Each season has a weekly pattern of task slots (e.g. *Desk 8–9 AM, Mon–Fri, 2 people*). Slots may overlap. **Fill from pre-set** turns a week of the pattern into shifts. |
| Worker types & tasks | Group people (Staff, Student, …) and limit tasks to certain worker types or named people. Breaks are tasks too. |
| Auto-Schedule | Assigns people to every open slot in a week: only eligible people, hard rules never broken, continuous blocks instead of scattered hours, each slot's usual people first, fair hours, and breaks for whoever works through them. Preview before saving. |
| Rule engine | Daily/weekly hour caps, rest between days, consecutive days, overtime, staffing levels, availability, and time off — hard (block) or soft (warn), scoped by department or worker type. |
| Calendar | Week, day, month, timeline, and per-person views; assign with live conflict checks; publish a week to make it visible to staff. |
| Staff app | My Schedule (phone-friendly): published shifts and coworkers, time-off requests, availability, open-shift pickup, give-away requests, and a personal calendar feed for Google/Apple/Outlook. |
| AI Copilot | Claude-powered assistant that reads the schedule and assigns, unassigns, or fills a whole week through the same rule checks. |
| Notifications | In-app, live: publishing, assignment changes, time-off and give-away decisions, open shifts picked up. |

## Layout

```
apps/web/                Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + Zustand
  src/lib/rule-engine.ts Conflict checks and Auto-Schedule (pure functions, unit-tested)
  src/app/api/           Server routes: AI Copilot, staff logins, open shifts, calendar feeds
supabase/migrations/     Database schema, Row Level Security, triggers (apply in order)
supabase/tests/          Database access-rule tests (plain Postgres)
supabase/snippets/       SQL Editor scripts (reset users, make yourself admin, sample pre-set)
scripts/                 One-time Appwrite → Supabase data copy
docs/                    Supabase setup, audit, product requirements
```

## Run it locally

Requires Node.js 20+ and a Supabase project (see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)).

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # fill in the values below
npm run dev                                     # http://localhost:3000
```

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."      # server only
ANTHROPIC_API_KEY="sk-ant-..."           # server only (AI Copilot)
```

## Checks

```bash
npm run typecheck   # TypeScript
npm test            # rule engine unit tests (Vitest)
npm run build       # production build
npm run test:db     # database access rules; needs a local Postgres, see supabase/tests/run.sh
```

GitHub Actions runs all four on every pull request (`.github/workflows/ci.yml`).

## Documentation

| Document | Path |
|----------|------|
| Supabase setup | [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) |
| Platform audit | [docs/AUDIT.md](docs/AUDIT.md) |
| Product requirements | [docs/PRD.md](docs/PRD.md) |

## License

Proprietary — TimeSync Scheduling © 2026
