-- ============================================================
-- Scheduling core: publishing, notifications, default rules,
-- template dedupe, and onboarding status.
-- ============================================================

-- ── Organizations: onboarding status ────────────────────────────────────────

alter table public.organizations add column onboarding_completed_at timestamptz;

-- ── Schedules: one row per org per week, with publish time ──────────────────

alter table public.schedules add column published_at timestamptz;
alter table public.schedules add constraint schedules_org_week_key unique (org_id, week_start);

-- ── Shifts generated from templates can't be generated twice ────────────────
-- NULLs are distinct, so hand-made shifts (no template) are unaffected.

alter table public.shifts add column template_id uuid references public.shift_templates(id) on delete set null;
create unique index shifts_template_date_key on public.shifts(template_id, date);

-- ── Staff only see shifts in published weeks ─────────────────────────────────

drop policy "members read" on public.shifts;

create policy "admins read" on public.shifts
  for select to authenticated
  using (org_id = (select private.current_org_id()) and (select private.is_org_admin()));

create policy "staff read published weeks" on public.shifts
  for select to authenticated
  using (
    org_id = (select private.current_org_id())
    and exists (
      select 1 from public.schedules sc
      where sc.org_id = shifts.org_id
        and sc.status = 'published'
        and shifts.date between sc.week_start and sc.week_end
    )
  );

-- ── Notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_org_idx  on public.notifications(org_id);

alter table public.notifications enable row level security;

-- Rows are written only by the triggers below (security definer). Users can
-- read, mark read, and dismiss their own.
create policy "read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dismiss own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Live updates for the notification bell.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

-- ── Notification helpers ─────────────────────────────────────────────────────

-- Notify every login linked to an employee record.
create or replace function private.notify_employee(
  p_org uuid, p_employee uuid, p_type text, p_title text, p_body text, p_link text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (org_id, user_id, type, title, body, link)
  select p_org, up.user_id, p_type, p_title, p_body, p_link
  from public.user_profiles up
  where up.org_id = p_org and up.employee_id = p_employee;
$$;

-- Notify every admin in the org except whoever made the change.
create or replace function private.notify_admins(
  p_org uuid, p_type text, p_title text, p_body text, p_link text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (org_id, user_id, type, title, body, link)
  select p_org, up.user_id, p_type, p_title, p_body, p_link
  from public.user_profiles up
  where up.org_id = p_org and up.role = 'admin'
    and up.user_id is distinct from (select auth.uid());
$$;

create or replace function private.is_week_published(p_org uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedules
    where org_id = p_org and status = 'published' and p_date between week_start and week_end
  );
$$;

create or replace function private.shift_label(p_title text, p_date date, p_start time, p_end time)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_date, 'Dy, Mon FMDD') || ' · ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI')
         || coalesce(' · ' || nullif(p_title, ''), '');
$$;

-- ── Trigger: shift assignments and changes (published weeks only) ──────────
-- Draft weeks stay quiet; staff hear about them when the week is published.

create or replace function private.on_shift_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp   uuid;
  v_label text;
  v_link  text;
begin
  if tg_op = 'DELETE' then
    if private.is_week_published(old.org_id, old.date) then
      v_label := private.shift_label(old.title, old.date, old.start_time, old.end_time);
      foreach v_emp in array old.assigned_employee_ids loop
        perform private.notify_employee(old.org_id, v_emp, 'shift_cancelled',
          'Shift cancelled', v_label, '/my-schedule?week=' || old.date);
      end loop;
    end if;
    return old;
  end if;

  if not private.is_week_published(new.org_id, new.date) then
    return new;
  end if;

  v_label := private.shift_label(new.title, new.date, new.start_time, new.end_time);
  v_link  := '/my-schedule?week=' || new.date;

  if tg_op = 'INSERT' then
    foreach v_emp in array new.assigned_employee_ids loop
      perform private.notify_employee(new.org_id, v_emp, 'shift_assigned', 'New shift assigned', v_label, v_link);
    end loop;
    return new;
  end if;

  -- UPDATE: newly added people
  foreach v_emp in array new.assigned_employee_ids loop
    if not (v_emp = any(old.assigned_employee_ids)) then
      perform private.notify_employee(new.org_id, v_emp, 'shift_assigned', 'New shift assigned', v_label, v_link);
    end if;
  end loop;
  -- removed people
  foreach v_emp in array old.assigned_employee_ids loop
    if not (v_emp = any(new.assigned_employee_ids)) then
      perform private.notify_employee(new.org_id, v_emp, 'shift_removed', 'Removed from a shift',
        private.shift_label(old.title, old.date, old.start_time, old.end_time), v_link);
    end if;
  end loop;
  -- people who stayed on a shift whose time or date moved
  if (new.date, new.start_time, new.end_time) is distinct from (old.date, old.start_time, old.end_time) then
    foreach v_emp in array new.assigned_employee_ids loop
      if v_emp = any(old.assigned_employee_ids) then
        perform private.notify_employee(new.org_id, v_emp, 'shift_changed', 'Shift time changed', v_label, v_link);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create trigger notify_shift_change
  after insert or update of assigned_employee_ids, date, start_time, end_time or delete
  on public.shifts
  for each row execute function private.on_shift_change();

-- ── Trigger: schedule published ──────────────────────────────────────────────

create or replace function private.on_schedule_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  for r in
    select emp_id, count(*) as n
    from public.shifts s, unnest(s.assigned_employee_ids) as emp_id
    where s.org_id = new.org_id and s.date between new.week_start and new.week_end
    group by emp_id
  loop
    perform private.notify_employee(new.org_id, r.emp_id, 'schedule_published',
      'Schedule published',
      'Week of ' || to_char(new.week_start, 'Mon FMDD') || ': you have ' || r.n || ' shift' || case when r.n = 1 then '' else 's' end || '.',
      '/my-schedule?week=' || new.week_start);
  end loop;
  return new;
end;
$$;

create trigger notify_schedule_published
  after insert or update of status on public.schedules
  for each row execute function private.on_schedule_published();

-- ── Trigger: time-off requests ───────────────────────────────────────────────

create or replace function private.on_time_off_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_range text := to_char(new.start_date, 'Mon FMDD')
    || case when new.end_date <> new.start_date then '–' || to_char(new.end_date, 'Mon FMDD') else '' end;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify_admins(new.org_id, 'time_off_requested', 'Time-off request',
      new.employee_name || ' · ' || new.leave_type || ' · ' || v_range, '/time-off');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status
        and new.status in ('approved', 'denied') and new.employee_id is not null then
    perform private.notify_employee(new.org_id, new.employee_id, 'time_off_' || new.status,
      'Time off ' || new.status, new.leave_type || ' · ' || v_range, '/my-schedule');
  end if;
  return new;
end;
$$;

create trigger notify_time_off_change
  after insert or update of status on public.time_off_requests
  for each row execute function private.on_time_off_change();

-- ── Default rules for every new organization ─────────────────────────────────

create or replace function private.insert_default_rules(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.scheduling_rules
    (org_id, name, description, rule_type, constraint_type, priority, weight, parameters, is_system)
  values
    (p_org, 'Weekly Hour Cap', 'No employee may be scheduled for more than 40 hours in a week',
       'MAX_HOURS_WEEK', 'hard', 5, null, '{"hours": 40}', true),
    (p_org, 'Minimum Rest Between Shifts', 'Employees need at least 10 hours off between shifts',
       'MIN_REST_BETWEEN', 'hard', 8, null, '{"hours": 10}', true),
    (p_org, 'Honor Employee Availability', 'Prefer scheduling within each employee''s availability',
       'PREFER_AVAILABILITY', 'soft', 100, 0.9, '{}', true),
    (p_org, 'Minimize Overtime', 'Warn before scheduling anyone past 40 hours in a week',
       'MINIMIZE_OVERTIME', 'soft', 105, 0.8, '{"hours": 40}', true),
    (p_org, 'Balance Weekend Shifts', 'Spread weekend shifts fairly when auto-scheduling',
       'BALANCE_WEEKENDS', 'soft', 110, 0.75, '{}', false);
$$;

create or replace function private.seed_default_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.insert_default_rules(new.id);
  return new;
end;
$$;

create trigger seed_default_rules
  after insert on public.organizations
  for each row execute function private.seed_default_rules();

-- Organizations created before this migration get the same defaults (only if
-- they have no rules at all).
select private.insert_default_rules(o.id)
from public.organizations o
where not exists (select 1 from public.scheduling_rules r where r.org_id = o.id);

-- ── Staff self-service ───────────────────────────────────────────────────────

-- Lets a staff member update only their own weekly availability.
create or replace function public.set_my_availability(p_availability jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
begin
  if v_emp is null then
    raise exception 'Your login is not linked to an employee record' using errcode = '42501';
  end if;
  update public.employees set weekly_availability = coalesce(p_availability, '{}'::jsonb) where id = v_emp;
end;
$$;

revoke execute on function public.set_my_availability(jsonb) from public, anon;
grant  execute on function public.set_my_availability(jsonb) to authenticated;

revoke execute on all functions in schema private from public, anon;
