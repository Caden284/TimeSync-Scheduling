-- ============================================================
-- Worker types, task types, pre-set schedules, shift drop
-- requests, and personal calendar feeds.
--
-- A pre-set schedule is a season's shift templates: weekly task
-- slots (which may overlap) that are generated into dated shifts
-- and then staffed by Auto-Schedule. Task types decide who is
-- eligible: certain worker types (e.g. Staff vs Student) and/or
-- specific people.
-- ============================================================

-- ── Worker types (org-defined; Staff and Student by default) ────────────────

create table public.worker_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  color       text not null default '#6366f1',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);

alter table public.employees add column worker_type_id uuid references public.worker_types(id) on delete set null;
create index employees_worker_type_idx on public.employees(worker_type_id);

-- ── Task types (what a shift slot is for, and who may work it) ──────────────

create table public.task_types (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  name                     text not null check (char_length(trim(name)) between 1 and 120),
  description              text,
  color                    text not null default '#6366f1',
  is_break                 boolean not null default false,
  -- Empty array = no restriction.
  allowed_worker_type_ids  uuid[] not null default '{}',
  allowed_employee_ids     uuid[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (org_id, name)
);

-- Pre-set slots and generated shifts point at their task. "Usually worked by"
-- people are preferred by Auto-Schedule when they're eligible and free.
alter table public.shift_templates add column task_type_id uuid references public.task_types(id) on delete set null;
alter table public.shift_templates add column preferred_employee_ids uuid[] not null default '{}';
alter table public.shifts add column task_type_id uuid references public.task_types(id) on delete set null;
alter table public.shifts add column preferred_employee_ids uuid[] not null default '{}';
create index shift_templates_task_type_idx on public.shift_templates(task_type_id);
create index shifts_task_type_idx on public.shifts(task_type_id);

-- Rules can target worker types (e.g. "Students: max 20 hours/week").
alter table public.scheduling_rules add column scope_worker_types uuid[] not null default '{}';

-- ── Shift drop requests (staff ask to give up a shift; admins decide) ───────

create table public.shift_requests (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  shift_id       uuid not null references public.shifts(id) on delete cascade,
  employee_id    uuid not null references public.employees(id) on delete cascade,
  employee_name  text not null,
  note           text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index shift_requests_one_pending on public.shift_requests(shift_id, employee_id) where status = 'pending';
create index shift_requests_org_idx on public.shift_requests(org_id, created_at desc);
create index shift_requests_employee_idx on public.shift_requests(employee_id);

-- ── Personal calendar feed token (iCal subscription URL) ────────────────────

alter table public.employees add column calendar_token uuid not null default gen_random_uuid();
create unique index employees_calendar_token_key on public.employees(calendar_token);

-- ── updated_at triggers ──────────────────────────────────────────────────────

create trigger set_updated_at before update on public.worker_types
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_types
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shift_requests
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.worker_types   enable row level security;
alter table public.task_types     enable row level security;
alter table public.shift_requests enable row level security;

do $$
declare t text;
begin
  foreach t in array array['worker_types', 'task_types'] loop
    execute format($f$
      create policy "members read" on public.%1$I
        for select to authenticated using (org_id = (select private.current_org_id()));
      create policy "admins insert" on public.%1$I
        for insert to authenticated
        with check (org_id = (select private.current_org_id()) and (select private.is_org_admin()));
      create policy "admins update" on public.%1$I
        for update to authenticated
        using (org_id = (select private.current_org_id()) and (select private.is_org_admin()))
        with check (org_id = (select private.current_org_id()));
      create policy "admins delete" on public.%1$I
        for delete to authenticated
        using (org_id = (select private.current_org_id()) and (select private.is_org_admin()));
    $f$, t);
  end loop;
end $$;

-- Admins manage every request in their org; staff see and file their own, and
-- may only file for a published shift they're actually on.
create policy "admins manage" on public.shift_requests
  for all to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_org_admin()))
  with check (org_id = (select private.current_org_id()) and (select private.is_org_admin()));
create policy "staff read own" on public.shift_requests
  for select to authenticated
  using (employee_id = (select private.current_employee_id()));
create policy "staff request own" on public.shift_requests
  for insert to authenticated
  with check (
    org_id = (select private.current_org_id())
    and employee_id = (select private.current_employee_id())
    and status = 'pending'
    and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.org_id = shift_requests.org_id
        and employee_id = any(s.assigned_employee_ids)
        and exists (
          select 1 from public.schedules sc
          where sc.org_id = s.org_id and sc.status = 'published'
            and s.date between sc.week_start and sc.week_end
        )
    )
  );
create policy "staff cancel own" on public.shift_requests
  for update to authenticated
  using (employee_id = (select private.current_employee_id()) and status = 'pending')
  with check (employee_id = (select private.current_employee_id()) and status = 'cancelled');

-- ── Notifications for drop requests ──────────────────────────────────────────

create or replace function private.on_shift_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  select private.shift_label(s.title, s.date, s.start_time, s.end_time) into v_label
  from public.shifts s where s.id = new.shift_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify_admins(new.org_id, 'shift_drop_requested', 'Shift drop request',
      new.employee_name || ' · ' || coalesce(v_label, 'a shift'), '/time-off?tab=shifts');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'denied') then
    perform private.notify_employee(new.org_id, new.employee_id, 'shift_drop_' || new.status,
      'Drop request ' || new.status, coalesce(v_label, 'Your shift'), '/my-schedule');
  end if;
  return new;
end;
$$;

create trigger notify_shift_request_change
  after insert or update of status on public.shift_requests
  for each row execute function private.on_shift_request_change();

-- ── Keep id lists clean when a worker type or employee is deleted ───────────

create or replace function private.on_worker_type_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_types set allowed_worker_type_ids = array_remove(allowed_worker_type_ids, old.id)
    where org_id = old.org_id and old.id = any(allowed_worker_type_ids);
  update public.scheduling_rules set scope_worker_types = array_remove(scope_worker_types, old.id)
    where org_id = old.org_id and old.id = any(scope_worker_types);
  return old;
end;
$$;

create trigger clean_worker_type_refs
  after delete on public.worker_types
  for each row execute function private.on_worker_type_delete();

create or replace function private.on_employee_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_types set allowed_employee_ids = array_remove(allowed_employee_ids, old.id)
    where org_id = old.org_id and old.id = any(allowed_employee_ids);
  update public.shift_templates set preferred_employee_ids = array_remove(preferred_employee_ids, old.id)
    where org_id = old.org_id and old.id = any(preferred_employee_ids);
  return old;
end;
$$;

create trigger clean_employee_refs
  after delete on public.employees
  for each row execute function private.on_employee_delete();

-- ── Defaults: worker types for every organization ────────────────────────────

create or replace function private.insert_default_worker_types(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.worker_types (org_id, name, color, sort_order)
  values (p_org, 'Staff', '#6366f1', 1), (p_org, 'Student', '#22c55e', 2)
  on conflict (org_id, name) do nothing;
$$;

create or replace function private.seed_default_worker_types()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.insert_default_worker_types(new.id);
  return new;
end;
$$;

create trigger seed_default_worker_types
  after insert on public.organizations
  for each row execute function private.seed_default_worker_types();

select private.insert_default_worker_types(o.id)
from public.organizations o
where not exists (select 1 from public.worker_types w where w.org_id = o.id);

-- ── Staff self-service: rotate my calendar link ──────────────────────────────

create or replace function public.rotate_my_calendar_token()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
  v_token uuid := gen_random_uuid();
begin
  if v_emp is null then
    raise exception 'Your login is not linked to an employee record' using errcode = '42501';
  end if;
  update public.employees set calendar_token = v_token where id = v_emp;
  return v_token;
end;
$$;

revoke execute on function public.rotate_my_calendar_token() from public, anon;
grant  execute on function public.rotate_my_calendar_token() to authenticated;

revoke execute on all functions in schema private from public, anon;
