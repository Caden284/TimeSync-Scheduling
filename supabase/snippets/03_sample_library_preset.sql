-- ============================================================
-- TimeSync — sample pre-set schedule for a university library
-- service desk, modeled on a LibStaffer week (desk rotations on
-- the hour and half hour, plus shipping, LibCal equipment,
-- housekeeping, discharge, breaks, and closing tasks).
--
-- Creates (or refreshes) for your organization:
--   • task types with who may do them (edit later in Settings → Tasks)
--   • a season with opening hours and its weekly pre-set slots
-- It adds no people: create employees (and set their worker type,
-- Staff or Student) yourself, then on the Schedule page use
-- "Fill from pre-set" and Auto-Schedule.
--
-- Requires migration 20261028000000_tasks_and_presets.sql.
-- Edit the values below, then run in SQL Editor. Safe to re-run:
-- the season's slots are replaced; shifts already generated stay.
-- ============================================================

do $$
declare
  v_admin_email text := 'you@example.com';   -- ← an admin login of your organization
  v_season      text := 'Fall 2026';
  v_start       date := '2026-08-17';
  v_end         date := '2026-12-12';
  v_org     uuid;
  v_season_id uuid;
  v_staff   uuid;
  r record;
  h int;
begin
  select up.org_id into v_org
  from public.user_profiles up join auth.users u on u.id = up.user_id
  where lower(u.email) = lower(trim(v_admin_email)) and up.role = 'admin';
  if v_org is null then
    raise exception 'No admin login "%" found. Use the email you sign in with.', v_admin_email;
  end if;

  select id into v_staff from public.worker_types where org_id = v_org and name = 'Staff';

  -- ── Tasks: name, color, is break, staff only ───────────────────────────────
  for r in select * from (values
    ('#LN1 Desk',                          '#6366f1', false, false),
    ('LibAnswers',                         '#0ea5e9', false, false),
    ('Monitor Phone and LibAnswers',       '#0ea5e9', false, false),
    ('LibCal Equipment Requests/Returns',  '#14b8a6', false, false),
    ('LibCal Equipment Audit',             '#0d9488', false, false),
    ('Equipment Cleaning',                 '#10b981', false, false),
    ('Marker Testing + Headphones',        '#84cc16', false, false),
    ('Housekeeping',                       '#a3a3a3', false, false),
    ('Double Discharge',                   '#f59e0b', false, false),
    ('Requests Hold Shelf & Lockers',      '#f97316', false, false),
    ('Requests USG',                       '#fb923c', false, false),
    ('Requests Intercampus',               '#fb923c', false, false),
    ('Walkthrough 1st–5th Floors',         '#8b5cf6', false, false),
    ('Cut Print Outs',                     '#a78bfa', false, false),
    ('Outgoing Shipment Intercampus',      '#ef4444', false, true),
    ('Outgoing Shipment FedEx',            '#ef4444', false, true),
    ('Outgoing Shipment ARCHE',            '#ef4444', false, true),
    ('Incoming Deliveries',                '#dc2626', false, true),
    ('Close LN2 Workroom',                 '#64748b', false, true),
    ('15 Minute Break',                    '#fbbf24', true,  false),
    ('Clock Out - 30 Minute Break',        '#fbbf24', true,  false)
  ) as t(name, color, is_break, staff_only) loop
    insert into public.task_types (org_id, name, color, is_break, allowed_worker_type_ids)
    values (v_org, r.name, r.color, r.is_break,
            case when r.staff_only and v_staff is not null then array[v_staff] else '{}'::uuid[] end)
    on conflict (org_id, name) do update
      set color = excluded.color, is_break = excluded.is_break;
  end loop;

  -- ── Season and opening hours ───────────────────────────────────────────────
  select id into v_season_id from public.seasons where org_id = v_org and name = v_season;
  if v_season_id is null then
    insert into public.seasons (org_id, name, season_type, start_date, end_date, is_active, hours)
    values (v_org, v_season, 'fall', v_start, v_end, true, jsonb_build_object(
      'sun', jsonb_build_object('start', '11:30', 'end', '21:00'),
      'mon', jsonb_build_object('start', '07:00', 'end', '23:00'),
      'tue', jsonb_build_object('start', '07:00', 'end', '23:00'),
      'wed', jsonb_build_object('start', '07:00', 'end', '23:00'),
      'thu', jsonb_build_object('start', '07:00', 'end', '23:00'),
      'fri', jsonb_build_object('start', '07:00', 'end', '21:00'),
      'sat', jsonb_build_object('start', '11:30', 'end', '21:00')))
    returning id into v_season_id;
  else
    delete from public.shift_templates where season_id = v_season_id;
  end if;

  create temp table _slots (task text, label text, s time, e time, days smallint[], people int) on commit drop;

  -- ── Desk rotations ─────────────────────────────────────────────────────────
  -- Weekdays: hourly blocks on the hour (2 people midday) and a staggered
  -- hourly block on the half hour, so someone fresh joins every 30 minutes.
  for h in 7..22 loop
    insert into _slots values ('#LN1 Desk', '#LN1 Desk', make_time(h, 0, 0), make_time(h + 1, 0, 0),
      case when h <= 20 then '{1,2,3,4,5}'::smallint[] else '{1,2,3,4}'::smallint[] end,
      case when h between 9 and 16 then 2 else 1 end);
  end loop;
  for h in 8..21 loop
    insert into _slots values ('#LN1 Desk', '#LN1 Desk', make_time(h, 30, 0), make_time(h + 1, 30, 0),
      case when h <= 19 then '{1,2,3,4,5}'::smallint[] else '{1,2,3,4}'::smallint[] end, 1);
  end loop;
  -- Weekends: opening, then the same two rotations until 9pm.
  insert into _slots values ('#LN1 Desk', 'LN1 Service Desk - Opening', '11:30', '12:00', '{0,6}', 2);
  for h in 12..20 loop
    insert into _slots values ('#LN1 Desk', 'LN1 Service Desk', make_time(h, 0, 0), make_time(h + 1, 0, 0), '{0,6}', 2);
  end loop;
  for h in 12..19 loop
    insert into _slots values ('#LN1 Desk', 'LN1 Service Desk', make_time(h, 30, 0), make_time(h + 1, 30, 0), '{0,6}', 1);
  end loop;

  -- ── Weekday tasks (1=Mon … 5=Fri) ──────────────────────────────────────────
  insert into _slots (task, label, s, e, days, people) values
    ('Outgoing Shipment Intercampus',     null, '07:00', '07:30', '{1,2,3,4,5}', 1),
    ('Requests USG',                      null, '07:30', '08:00', '{1,2,4,5}',   1),
    ('LibCal Equipment Requests/Returns', null, '08:00', '09:00', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '09:00', '09:30', '{1,2,3,4,5}', 1),
    ('Outgoing Shipment ARCHE',           null, '09:00', '09:30', '{1,3,4}',     1),
    ('Outgoing Shipment FedEx',           null, '09:30', '10:00', '{1,2,4,5}',   1),
    ('Outgoing Shipment FedEx',           null, '10:00', '10:30', '{3}',         1),
    ('LibCal Equipment Requests/Returns', null, '10:00', '11:00', '{1,2,3,4,5}', 1),
    ('Housekeeping',                      null, '10:00', '10:30', '{1,2,3,4,5}', 1),
    ('Requests Hold Shelf & Lockers',     null, '10:00', '10:30', '{1,2,3,4,5}', 1),
    ('Double Discharge',                  'Double Discharge All', '10:30', '11:00', '{1,2,3,4,5}', 1),
    ('Housekeeping',                      null, '11:00', '11:30', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '11:00', '11:30', '{1,2,3,4,5}', 1),
    ('15 Minute Break',                   null, '11:00', '11:15', '{1,2,3,4,5}', 1),
    ('Equipment Cleaning',                null, '11:00', '12:00', '{4,5}',       1),
    ('LibCal Equipment Requests/Returns', null, '12:00', '13:00', '{1,2,3,4,5}', 1),
    ('Housekeeping',                      null, '12:00', '12:30', '{1,2,3,4,5}', 1),
    ('Walkthrough 1st–5th Floors',        null, '12:00', '13:00', '{2}',         1),
    ('Double Discharge',                  'Double Discharge Laptops', '12:30', '13:00', '{1,2,3,4,5}', 1),
    ('Marker Testing + Headphones',       null, '12:30', '13:00', '{2,5}',       1),
    ('LibCal Equipment Audit',            null, '13:00', '14:00', '{1,2,3,4,5}', 1),
    ('Housekeeping',                      null, '13:00', '13:30', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '13:00', '13:30', '{1,2,3,4,5}', 1),
    ('15 Minute Break',                   null, '13:00', '13:15', '{1,2,3,4,5}', 1),
    ('Equipment Cleaning',                null, '13:15', '14:00', '{1,2}',       1),
    ('Clock Out - 30 Minute Break',       null, '13:30', '14:00', '{1,2,3,4,5}', 1),
    ('Incoming Deliveries',               'Incoming Deliveries ARCHE', '13:30', '14:00', '{1,3,4}', 1),
    ('LibCal Equipment Requests/Returns', null, '14:00', '15:00', '{1,2,3,4,5}', 1),
    ('Housekeeping',                      null, '14:00', '14:30', '{1,2,3,4,5}', 1),
    ('Cut Print Outs',                    null, '14:00', '14:30', '{2}',         1),
    ('Double Discharge',                  null, '14:30', '15:00', '{1,2,3,4,5}', 1),
    ('Requests Intercampus',              null, '14:30', '15:00', '{1,2,3,4,5}', 1),
    ('Incoming Deliveries',               'Incoming Deliveries Intercampus', '15:00', '15:30', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '15:00', '15:30', '{1,2,3,4,5}', 1),
    ('15 Minute Break',                   null, '15:00', '15:15', '{1,2,3,4,5}', 1),
    ('Walkthrough 1st–5th Floors',        null, '15:15', '16:00', '{1,2,3,4,5}', 1),
    ('Requests Hold Shelf & Lockers',     null, '15:30', '16:00', '{1,2,3,4,5}', 1),
    ('LibCal Equipment Requests/Returns', null, '16:00', '17:00', '{1,2,3,4,5}', 1),
    ('Requests USG',                      null, '16:00', '16:30', '{1,2,3,4}',   1),
    ('Housekeeping',                      null, '16:00', '16:30', '{1,2,3,4,5}', 1),
    ('Double Discharge',                  'Double Discharge All', '16:30', '17:00', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '17:00', '17:30', '{1,2,3,4,5}', 1),
    ('Outgoing Shipment FedEx',           null, '17:00', '17:30', '{1,2,3,4,5}', 1),
    ('15 Minute Break',                   null, '17:00', '17:15', '{1,2,3,4,5}', 1),
    ('LibCal Equipment Requests/Returns', 'LibCal Equipment Requests', '18:00', '18:30', '{1,2,3,4,5}', 1),
    ('LibCal Equipment Requests/Returns', 'LibCal Equipment Returns', '18:30', '19:00', '{1,2,3,4,5}', 1),
    ('LibAnswers',                        null, '20:00', '20:30', '{1,2,3,4,5}', 1),
    ('15 Minute Break',                   null, '20:00', '20:15', '{1,2,3,4}',   1),
    ('Close LN2 Workroom',                null, '20:30', '21:00', '{5}',         1),
    ('Close LN2 Workroom',                null, '22:30', '23:00', '{1,2,3,4}',   1);

  -- ── Weekend tasks (0=Sun, 6=Sat) ───────────────────────────────────────────
  insert into _slots (task, label, s, e, days, people) values
    ('LibCal Equipment Requests/Returns', null, '12:00', '13:00', '{0,6}', 1),
    ('LibCal Equipment Requests/Returns', 'LibCal Equipment Returns', '12:30', '13:00', '{0}', 1),
    ('LibCal Equipment Audit',            null, '13:00', '14:00', '{0,6}', 1),
    ('Monitor Phone and LibAnswers',      null, '13:00', '13:30', '{0,6}', 1),
    ('LibCal Equipment Requests/Returns', null, '15:00', '16:00', '{0,6}', 1),
    ('Monitor Phone and LibAnswers',      null, '15:00', '15:30', '{0,6}', 1),
    ('Clock Out - 30 Minute Break',       null, '16:00', '16:30', '{0,6}', 1),
    ('Housekeeping',                      null, '16:00', '16:30', '{0}',   1),
    ('Double Discharge',                  'Double Discharge All', '16:30', '17:00', '{0}', 1),
    ('Clock Out - 30 Minute Break',       null, '17:00', '17:30', '{0,6}', 1),
    ('Monitor Phone and LibAnswers',      null, '17:00', '17:30', '{0,6}', 1),
    ('Marker Testing + Headphones',       null, '17:30', '18:00', '{0}',   1),
    ('LibCal Equipment Requests/Returns', null, '18:00', '18:30', '{0,6}', 1),
    ('LibCal Equipment Requests/Returns', 'LibCal Equipment Returns', '18:30', '19:00', '{0,6}', 1),
    ('Monitor Phone and LibAnswers',      null, '20:00', '20:30', '{0,6}', 1),
    ('Close LN2 Workroom',                null, '20:30', '21:00', '{0,6}', 1);

  insert into public.shift_templates
    (org_id, season_id, name, start_time, end_time, color, min_staff, days_of_week, task_type_id)
  select v_org, v_season_id, coalesce(sl.label, sl.task), sl.s, sl.e, t.color, sl.people, sl.days, t.id
  from _slots sl join public.task_types t on t.org_id = v_org and t.name = sl.task;

  raise notice 'Season "%": % task types, % pre-set slots.', v_season,
    (select count(*) from public.task_types where org_id = v_org),
    (select count(*) from public.shift_templates where season_id = v_season_id);
end $$;
