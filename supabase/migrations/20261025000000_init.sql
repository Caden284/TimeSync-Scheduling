-- ============================================================
-- TimeSync Scheduling — Supabase schema (replaces the Appwrite
-- `timesync-db` database and its 13 collections).
--
-- Every org-owned table carries `org_id` and is protected by Row Level
-- Security: a signed-in user can only ever see rows belonging to the
-- organization recorded in their `user_profiles` row, and only admins
-- can write. Apply with the Supabase SQL editor or `supabase db push`.
-- ============================================================

create extension if not exists pgcrypto;

-- ── updated_at helper ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Organizations ────────────────────────────────────────────────────────────

create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  vertical       text,
  timezone       text,
  primary_color  text,
  logo_initials  text check (char_length(logo_initials) <= 4),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Departments & Locations ──────────────────────────────────────────────────

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index departments_org_id_idx on public.departments(org_id);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  city        text,
  state       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index locations_org_id_idx on public.locations(org_id);

-- ── Employees ────────────────────────────────────────────────────────────────
-- department_id is free text (no FK): the UI still sources departments from the
-- browser-local onboarding data, whose ids are not database ids.

create table public.employees (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  first_name           text not null,
  last_name            text not null,
  email                text,
  phone                text,
  role                 text,
  department_id        text,
  department_name      text,
  employment_type      text,
  pay_rate             numeric(10,2) check (pay_rate is null or pay_rate >= 0),
  is_active            boolean not null default true,
  avatar_color         text,
  weekly_availability  jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index employees_org_id_idx on public.employees(org_id);

-- ── User profiles (links auth.users → organization + role) ───────────────────

create table public.user_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  role         text not null check (role in ('admin', 'staff')),
  first_name   text not null default '',
  last_name    text not null default '',
  email        text not null,
  employee_id  uuid references public.employees(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index user_profiles_org_id_idx on public.user_profiles(org_id);

-- ── Schedules, Shifts, Assignments ───────────────────────────────────────────

create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text,
  week_start  date not null,
  week_end    date not null,
  status      text not null default 'draft' check (status in ('draft', 'review', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index schedules_org_id_idx on public.schedules(org_id, week_start desc);

create table public.shifts (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  schedule_id              uuid references public.schedules(id) on delete set null,
  title                    text,
  date                     date not null,
  start_time               time not null,
  end_time                 time not null,
  department_id            text,
  department_name          text,
  department_color         text,
  location_id              text,
  location_name            text,
  shift_type               text not null default 'fixed',
  status                   text not null default 'scheduled',
  is_open                  boolean not null default false,
  min_staff                integer not null default 1 check (min_staff between 1 and 500),
  max_staff                integer check (max_staff is null or max_staff between 1 and 500),
  color                    text,
  notes                    text,
  assigned_employee_ids    uuid[] not null default '{}',
  assigned_employee_names  text[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index shifts_org_date_idx on public.shifts(org_id, date);
create index shifts_assigned_idx on public.shifts using gin (assigned_employee_ids);

create table public.shift_assignments (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts(id) on delete cascade,
  employee_id    uuid not null references public.employees(id) on delete cascade,
  employee_name  text,
  status         text not null default 'confirmed',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (shift_id, employee_id)
);
create index shift_assignments_employee_idx on public.shift_assignments(employee_id);

-- ── Time off ─────────────────────────────────────────────────────────────────

create table public.time_off_requests (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  employee_id    uuid references public.employees(id) on delete set null,
  employee_name  text not null,
  leave_type     text not null,
  start_date     date not null,
  end_date       date not null,
  reason         text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date >= start_date)
);
create index time_off_requests_org_idx on public.time_off_requests(org_id, created_at desc);

-- ── Rule engine ──────────────────────────────────────────────────────────────

create table public.scheduling_rules (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  rule_type        text not null,
  constraint_type  text not null check (constraint_type in ('hard', 'soft')),
  description      text not null default '',
  is_enabled       boolean not null default true,
  is_system        boolean not null default false,
  priority         integer not null default 50 check (priority between 1 and 200),
  weight           real,
  parameters       jsonb not null default '{}'::jsonb,
  scope_depts      text[] not null default '{}',
  scope_locations  text[] not null default '{}',
  scope_roles      text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index scheduling_rules_org_idx on public.scheduling_rules(org_id, priority);

-- ── Seasons & shift templates ────────────────────────────────────────────────

create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  season_type  text not null,
  start_date   date not null,
  end_date     date not null,
  is_active    boolean not null default false,
  hours        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index seasons_org_idx on public.seasons(org_id, start_date);

create table public.shift_templates (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  season_id        uuid not null references public.seasons(id) on delete cascade,
  name             text not null,
  start_time       time not null,
  end_time         time not null,
  color            text not null default '#6366f1',
  department_id    text,
  department_name  text,
  min_staff        integer not null default 1 check (min_staff between 1 and 500),
  days_of_week     smallint[] not null default '{1,2,3,4,5}',
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index shift_templates_org_idx on public.shift_templates(org_id);
create index shift_templates_season_idx on public.shift_templates(season_id);

create table public.availability_overrides (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  employee_name   text not null,
  date            date not null,
  is_available    boolean not null,
  reason          text,
  alt_start_time  time,
  alt_end_time    time,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index availability_overrides_emp_idx on public.availability_overrides(employee_id, date);
create index availability_overrides_org_idx on public.availability_overrides(org_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','departments','locations','employees','user_profiles',
    'schedules','shifts','shift_assignments','time_off_requests',
    'scheduling_rules','seasons','shift_templates','availability_overrides'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- Auth helpers (SECURITY DEFINER so policies can read user_profiles
-- without recursing into user_profiles' own policies).
-- ============================================================

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.user_profiles where user_id = (select auth.uid());
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee_id from public.user_profiles where user_id = (select auth.uid());
$$;

revoke execute on function public.current_org_id()      from public, anon;
revoke execute on function public.is_org_admin()        from public, anon;
revoke execute on function public.current_employee_id() from public, anon;
grant  execute on function public.current_org_id()      to authenticated;
grant  execute on function public.is_org_admin()        to authenticated;
grant  execute on function public.current_employee_id() to authenticated;

-- First-run signup: creates the organization and makes the caller its admin.
-- Called by the signed-in user right after supabase.auth.signUp(); refuses if
-- the caller already belongs to an organization.
create or replace function public.bootstrap_organization(
  p_org_name    text,
  p_vertical    text default null,
  p_timezone    text default null,
  p_first_name  text default '',
  p_last_name   text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.user_profiles where user_id = v_uid) then
    raise exception 'This account already belongs to an organization' using errcode = '23505';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.organizations (name, vertical, timezone, primary_color, logo_initials)
  values (
    trim(p_org_name), p_vertical, p_timezone, '#6366f1',
    upper(left(regexp_replace(initcap(trim(p_org_name)), '[^A-Z]', '', 'g'), 2))
  )
  returning id into v_org_id;

  insert into public.user_profiles (user_id, org_id, role, first_name, last_name, email)
  values (v_uid, v_org_id, 'admin', coalesce(p_first_name, ''), coalesce(p_last_name, ''), coalesce(v_email, ''));

  return v_org_id;
end;
$$;

revoke execute on function public.bootstrap_organization(text, text, text, text, text) from public, anon;
grant  execute on function public.bootstrap_organization(text, text, text, text, text) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.organizations          enable row level security;
alter table public.departments            enable row level security;
alter table public.locations              enable row level security;
alter table public.employees              enable row level security;
alter table public.user_profiles          enable row level security;
alter table public.schedules              enable row level security;
alter table public.shifts                 enable row level security;
alter table public.shift_assignments      enable row level security;
alter table public.time_off_requests      enable row level security;
alter table public.scheduling_rules       enable row level security;
alter table public.seasons                enable row level security;
alter table public.shift_templates        enable row level security;
alter table public.availability_overrides enable row level security;

-- Organizations: members read their own org; admins update it. Creation goes
-- through bootstrap_organization(); deletion is dashboard-only.
create policy "members read own org" on public.organizations
  for select to authenticated using (id = (select public.current_org_id()));
create policy "admins update own org" on public.organizations
  for update to authenticated
  using (id = (select public.current_org_id()) and (select public.is_org_admin()))
  with check (id = (select public.current_org_id()));

-- Tables every member of the org may read (staff need these to view their
-- schedule), and only admins may write.
do $$
declare t text;
begin
  foreach t in array array['departments','locations','schedules','shifts','seasons','shift_templates'] loop
    execute format($f$
      create policy "members read" on public.%1$I
        for select to authenticated using (org_id = (select public.current_org_id()));
      create policy "admins insert" on public.%1$I
        for insert to authenticated
        with check (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
      create policy "admins update" on public.%1$I
        for update to authenticated
        using (org_id = (select public.current_org_id()) and (select public.is_org_admin()))
        with check (org_id = (select public.current_org_id()));
      create policy "admins delete" on public.%1$I
        for delete to authenticated
        using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
    $f$, t);
  end loop;
end $$;

-- Tables holding sensitive staff data (pay rates, contact info, leave):
-- admins have full access; staff only see rows about themselves.
do $$
declare t text;
begin
  foreach t in array array['employees','scheduling_rules','availability_overrides','time_off_requests'] loop
    execute format($f$
      create policy "admins read" on public.%1$I
        for select to authenticated
        using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
      create policy "admins insert" on public.%1$I
        for insert to authenticated
        with check (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
      create policy "admins update" on public.%1$I
        for update to authenticated
        using (org_id = (select public.current_org_id()) and (select public.is_org_admin()))
        with check (org_id = (select public.current_org_id()));
      create policy "admins delete" on public.%1$I
        for delete to authenticated
        using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
    $f$, t);
  end loop;
end $$;

create policy "staff read own employee row" on public.employees
  for select to authenticated
  using (id = (select public.current_employee_id()));

create policy "staff read own time off" on public.time_off_requests
  for select to authenticated
  using (org_id = (select public.current_org_id()) and employee_id = (select public.current_employee_id()));
create policy "staff request own time off" on public.time_off_requests
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and employee_id = (select public.current_employee_id())
    and status = 'pending'
  );

create policy "staff read own overrides" on public.availability_overrides
  for select to authenticated
  using (org_id = (select public.current_org_id()) and employee_id = (select public.current_employee_id()));

-- Shift assignments inherit their org from the parent shift.
create policy "members read" on public.shift_assignments
  for select to authenticated
  using (exists (select 1 from public.shifts s
                 where s.id = shift_id and s.org_id = (select public.current_org_id())));
create policy "admins write" on public.shift_assignments
  for all to authenticated
  using ((select public.is_org_admin()) and exists (select 1 from public.shifts s
         where s.id = shift_id and s.org_id = (select public.current_org_id())))
  with check ((select public.is_org_admin()) and exists (select 1 from public.shifts s
         where s.id = shift_id and s.org_id = (select public.current_org_id())));

-- User profiles: everyone reads their own; admins read and manage their org's.
-- Profiles are created by bootstrap_organization() or the server-side invite
-- route (service role), never directly by the browser.
create policy "read own profile" on public.user_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admins read org profiles" on public.user_profiles
  for select to authenticated
  using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));
create policy "admins update org profiles" on public.user_profiles
  for update to authenticated
  using (org_id = (select public.current_org_id()) and (select public.is_org_admin()))
  with check (org_id = (select public.current_org_id()));
create policy "admins delete org profiles" on public.user_profiles
  for delete to authenticated
  using (org_id = (select public.current_org_id()) and (select public.is_org_admin())
         and user_id <> (select auth.uid()));

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;
