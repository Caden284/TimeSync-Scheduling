-- ============================================================
-- TimeSync — create an organization and make a login its admin.
--
-- FIRST create the login (this keeps your password out of SQL history):
--   Supabase → Authentication → Users → Add user → Create new user
--   → enter your email + password, tick "Auto Confirm User" → Create user
--
-- THEN edit the values below and run this in SQL Editor.
-- ============================================================

do $$
declare
  v_email     text := 'you@example.com';    -- ← the email you just added
  v_org_name  text := 'My Organization';    -- ← your organization's name
  v_first     text := 'First';              -- ← your first name
  v_last      text := 'Last';               -- ← your last name
  v_timezone  text := 'America/New_York';   -- ← e.g. America/Chicago, America/Los_Angeles
  v_user      uuid;
  v_org       uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(v_email));
  if v_user is null then
    raise exception 'No login found for "%". Create it first under Authentication → Users → Add user.', v_email;
  end if;
  if exists (select 1 from public.user_profiles where user_id = v_user) then
    raise exception '"%" is already linked to an organization.', v_email;
  end if;

  insert into public.organizations (name, vertical, timezone, primary_color, logo_initials)
  values (trim(v_org_name), 'other', v_timezone, '#6366f1',
          upper(left(regexp_replace(initcap(trim(v_org_name)), '[^A-Z]', '', 'g'), 2)))
  returning id into v_org;

  insert into public.user_profiles (user_id, org_id, role, first_name, last_name, email)
  values (v_user, v_org, 'admin', v_first, v_last, lower(trim(v_email)));

  raise notice 'Done — % is now the admin of "%". Sign in at /login.', v_email, v_org_name;
end $$;
