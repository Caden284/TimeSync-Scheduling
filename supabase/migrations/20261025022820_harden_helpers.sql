-- Keep the RLS helper functions out of the public REST API (/rest/v1/rpc/*).
-- Policies reference functions by oid, so moving the schema doesn't break them.
-- bootstrap_organization() stays in public: the browser calls it at signup.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.current_org_id()      set schema private;
alter function public.is_org_admin()        set schema private;
alter function public.current_employee_id() set schema private;

-- Cover the remaining foreign keys (Supabase performance advisor).
create index shifts_schedule_id_idx           on public.shifts(schedule_id);
create index time_off_requests_employee_idx   on public.time_off_requests(employee_id);
create index user_profiles_employee_id_idx    on public.user_profiles(employee_id);
