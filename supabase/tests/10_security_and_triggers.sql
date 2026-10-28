-- ============================================================
-- Behavioural tests for RLS policies and triggers.
-- Run after 00_supabase_stub.sql and every migration. Any failed
-- expectation raises an exception (psql -v ON_ERROR_STOP=1 exits 3).
-- ============================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
-- Runs a statement that must be rejected.
create or replace function pg_temp.expect_error(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: % (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — statement was allowed', what;
end $$;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin-a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'admin-b@test'),
  ('00000000-0000-0000-0000-00000000000c', 'staff-a@test');

-- ── Org A (admin A) and org B (admin B) ─────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select bootstrap_organization('Org A');
select pg_temp.expect((select count(*) from scheduling_rules) = 5, 'new org gets 5 default rules');
select pg_temp.expect((select count(*) from worker_types) = 2, 'new org gets Staff and Student worker types');
select pg_temp.expect_error($$ select bootstrap_organization('Second') $$, 'cannot bootstrap twice');
insert into employees (org_id, first_name, last_name, worker_type_id)
  select org_id, 'Sam', 'Student', (select id from worker_types where name = 'Student')
  from user_profiles where user_id = auth.uid();
insert into task_types (org_id, name, allowed_worker_type_ids)
  select org_id, 'Shipping', array[(select id from worker_types where name = 'Staff')]
  from user_profiles where user_id = auth.uid();
select pg_temp.as_admin();

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select bootstrap_organization('Org B');
select pg_temp.expect((select count(*) from organizations) = 1, 'admin B sees only their org');
select pg_temp.expect((select count(*) from employees) = 0, 'admin B sees no Org A employees');
select pg_temp.expect((select count(*) from task_types) = 0, 'admin B sees no Org A task types');
select pg_temp.expect((select count(*) from worker_types) = 2, 'admin B sees only their own worker types');
select pg_temp.expect_error(format($$ insert into shifts (org_id, date, start_time, end_time) values (%L, '2026-10-26', '08:00', '09:00') $$,
  (select id from organizations o where o.name = 'Org A')), 'admin B cannot write into Org A');
select pg_temp.as_admin();
select pg_temp.expect((select count(*) from organizations where name = 'Org A') = 1, 'Org A still intact');

-- ── Staff in Org A ───────────────────────────────────────────────────────────
insert into user_profiles (user_id, org_id, role, email, employee_id)
  select '00000000-0000-0000-0000-00000000000c', o.id, 'staff', 'staff-a@test', e.id
  from organizations o join employees e on e.org_id = o.id where o.name = 'Org A';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into shifts (org_id, title, date, start_time, end_time, assigned_employee_ids, assigned_employee_names)
  select org_id, 'Desk', '2026-10-27', '08:00', '12:00', array[(select id from employees limit 1)], array['Sam Student']
  from user_profiles where user_id = auth.uid();
select pg_temp.as_admin();

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from shifts) = 0, 'staff cannot see draft weeks');
select pg_temp.expect((select count(*) from employees) = 1, 'staff sees only their own employee row');
select pg_temp.expect((select count(*) from task_types) = 1, 'staff can read task types');
select pg_temp.expect_error($$ insert into task_types (org_id, name) select org_id, 'x' from user_profiles where user_id = auth.uid() $$, 'staff cannot create task types');
select pg_temp.expect_error($$ update user_profiles set role = 'admin' where user_id = auth.uid() returning 1/0 $$, 'staff cannot promote themselves');
select pg_temp.as_admin();
select pg_temp.expect((select role from user_profiles where email = 'staff-a@test') = 'staff', 'staff role unchanged');

-- ── Publishing and notifications ─────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into schedules (org_id, week_start, week_end, status)
  select org_id, '2026-10-25', '2026-10-31', 'published' from user_profiles where user_id = auth.uid();
select pg_temp.as_admin();

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from shifts) = 1, 'staff sees published week');
select pg_temp.expect((select count(*) from notifications where type = 'schedule_published') = 1, 'staff notified on publish');
-- drop request: allowed for own published shift, not for someone else's
insert into shift_requests (org_id, shift_id, employee_id, employee_name)
  select s.org_id, s.id, s.assigned_employee_ids[1], 'Sam Student' from shifts s limit 1;
select pg_temp.expect_error($$ insert into shift_requests (org_id, shift_id, employee_id, employee_name)
  select s.org_id, s.id, s.assigned_employee_ids[1], 'Sam' from shifts s limit 1 $$, 'only one pending drop request per shift');
select pg_temp.expect_error($$ update shift_requests set status = 'approved' returning 1/0 $$, 'staff cannot approve their own request');
select pg_temp.expect_error($$ update notifications set title = 'x' $$, 'staff cannot edit notification text');
select pg_temp.expect_error($$ insert into notifications (org_id, user_id, type, title) select org_id, user_id, 't', 'spoof' from user_profiles where user_id = auth.uid() $$, 'staff cannot forge notifications');
select rotate_my_calendar_token();
select pg_temp.as_admin();

select pg_temp.expect((select count(*) from notifications n join auth.users u on u.id = n.user_id
  where u.email = 'admin-a@test' and n.type = 'shift_drop_requested') = 1, 'admin notified of drop request');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update shift_requests set status = 'approved', decided_at = now();
update shifts set assigned_employee_ids = '{}', assigned_employee_names = '{}';
select pg_temp.as_admin();
select pg_temp.expect((select count(*) from notifications n join auth.users u on u.id = n.user_id
  where u.email = 'staff-a@test' and n.type in ('shift_drop_approved', 'shift_removed')) = 2, 'staff notified of approval and removal');

-- ── Template shifts can't be generated twice ────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into seasons (org_id, name, season_type, start_date, end_date)
  select org_id, 'Fall', 'academic', '2026-08-15', '2026-12-15' from user_profiles where user_id = auth.uid();
insert into shift_templates (org_id, season_id, name, start_time, end_time, task_type_id)
  select org_id, (select id from seasons), 'Shipping', '09:00', '09:30', (select id from task_types) from user_profiles where user_id = auth.uid();
insert into shifts (org_id, template_id, date, start_time, end_time)
  select org_id, (select id from shift_templates), '2026-11-02', '09:00', '09:30' from user_profiles where user_id = auth.uid();
select pg_temp.expect_error($$ insert into shifts (org_id, template_id, date, start_time, end_time)
  select org_id, (select id from shift_templates), '2026-11-02', '09:00', '09:30' from user_profiles where user_id = auth.uid() $$,
  'template shift cannot be generated twice for a date');
select pg_temp.as_admin();

-- ── Deleting a worker type or employee cleans up id lists ───────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update task_types set allowed_employee_ids = array[(select id from employees where first_name = 'Sam')];
update shift_templates set preferred_employee_ids = array[(select id from employees where first_name = 'Sam')];
update scheduling_rules set scope_worker_types = array[(select id from worker_types where name = 'Staff')] where rule_type = 'MAX_HOURS_WEEK';
delete from worker_types where name = 'Staff';
select pg_temp.expect((select allowed_worker_type_ids from task_types where name = 'Shipping') = '{}', 'deleted worker type leaves task eligibility');
select pg_temp.expect((select scope_worker_types from scheduling_rules where rule_type = 'MAX_HOURS_WEEK') = '{}', 'deleted worker type leaves rule scope');
delete from employees where first_name = 'Sam';
select pg_temp.expect((select allowed_employee_ids from task_types where name = 'Shipping') = '{}', 'deleted employee leaves task eligibility');
select pg_temp.expect((select preferred_employee_ids from shift_templates limit 1) = '{}', 'deleted employee leaves usual-people list');
select pg_temp.as_admin();

-- ── Anonymous visitors ───────────────────────────────────────────────────────
set role anon;
select pg_temp.expect_error($$ select count(*) from shifts $$, 'anon cannot read shifts');
select pg_temp.expect_error($$ select private.current_org_id() $$, 'anon cannot call private helpers');
reset role;

\echo ALL DATABASE TESTS PASSED
