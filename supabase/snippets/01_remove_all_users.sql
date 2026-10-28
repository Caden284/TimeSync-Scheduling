-- ============================================================
-- TimeSync — remove ALL users and ALL organization data.
-- Run in Supabase → SQL Editor. This cannot be undone.
-- ============================================================

-- Organizations first: deleting one cascades to everything it owns
-- (profiles, employees, shifts, rules, seasons, time off, …).
delete from public.organizations;

-- Then every login. Sessions and identities are removed with them.
delete from auth.users;

-- Should print 0 | 0 | 0
select (select count(*) from auth.users)           as users_left,
       (select count(*) from public.user_profiles) as profiles_left,
       (select count(*) from public.organizations) as organizations_left;
