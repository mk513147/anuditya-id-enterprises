-- READ-ONLY verification after provisioning. Run in the Supabase Dashboard SQL editor. ONE SELECT statement: it changes nothing.
--
-- Fill in the two placeholders in the first CTE (the administrator's UID and email) so the profile can be matched to the
-- intended Auth user. Without them the matching rows report INCONCLUSIVE and the overall result cannot be PASS.
--
-- Every row is PASS, FAIL or INCONCLUSIVE (see 01_preflight_read_only.sql for the meaning). A missing administrator is a FAIL,
-- never "no rows". The last row, OVERALL, is PASS only if every row passed.
--
-- What this proves and what it does not: it checks the recorded profile, the Auth user, DATABASE GRANTS (table level AND column level)
-- and the catalog definitions of the protections (policies, trigger, index). Grants and policy definitions are not the same as runtime
-- behaviour, and neither alone proves the authorization model. The remaining proof is functional: signing in at /admin as the
-- administrator (is_admin() depends on your own sign-in token, which SQL run here cannot present), and the anonymous checks in
-- supabase/verification/verify-public-api.mjs.

with
cfg as (
  select
    case when '<ADMIN_AUTH_USER_UID>'  like '<%' then null else lower(btrim('<ADMIN_AUTH_USER_UID>'))  end as uid,
    case when '<INTENDED_ADMIN_EMAIL>' like '<%' then null else lower(btrim('<INTENDED_ADMIN_EMAIL>')) end as email
),
admins as (select p.id from public.profiles p where p.role = 'admin'),
adm as (select j.j from (select to_jsonb(u) as j from auth.users u join admins a on a.id = u.id) j),   -- the Auth user behind the admin profile

checks(n, name, result, detail) as (
  -- ------------------------------------------------------------------------------------------ the administrator
  select 1, 'exactly one administrator profile exists',
         case when (select count(*) from admins) = 1 then 'PASS' else 'FAIL' end,
         (select count(*) from admins) || ' administrator profile(s) found (0 = not provisioned yet; more than 1 should be impossible).'
  union all
  select 2, 'the administrator profile belongs to the intended Auth user (UID)',
         case when c.uid is null then 'INCONCLUSIVE'
              when (select count(*) from admins) <> 1 then 'FAIL'
              when exists (select 1 from admins a where a.id::text = c.uid) then 'PASS' else 'FAIL' end,
         case when c.uid is null then 'No UID given in the first CTE.' else 'The profile id is compared with the UID you supplied.' end
  from cfg c
  union all
  select 3, 'the Auth user for that profile exists',
         case when (select count(*) from admins) <> 1 then 'FAIL' when exists (select 1 from adm) then 'PASS' else 'FAIL' end,
         'auth.users joined to the profile by id (the foreign key also guarantees this).'
  union all
  select 4, 'that Auth user''s email equals the intended administrator email',
         case when c.email is null then 'INCONCLUSIVE'
              when not exists (select 1 from adm) then 'FAIL'
              when lower(btrim(coalesce((select j ->> 'email' from adm), ''))) = c.email then 'PASS' else 'FAIL' end,
         case when c.email is null then 'No intended email given in the first CTE.' else 'Case-insensitive comparison with the email you typed.' end
  from cfg c
  union all
  select 5, 'that Auth user''s email is confirmed',
         case when not exists (select 1 from adm) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.email_confirmed_at') from adm) then 'INCONCLUSIVE'
              when (select j ->> 'email_confirmed_at' from adm) is not null then 'PASS' else 'FAIL' end,
         'INCONCLUSIVE means the column is not exposed: confirm the user shows as confirmed in the Dashboard.'
  union all
  select 6, 'that Auth user is not soft-deleted, banned, anonymous or single-sign-on',
         case when not exists (select 1 from adm) then 'FAIL'
              when (select (jsonb_path_exists(j, '$.deleted_at') and j ->> 'deleted_at' is not null)
                         or (jsonb_path_exists(j, '$.banned_until') and j ->> 'banned_until' is not null and (j ->> 'banned_until')::timestamptz > now())
                         or (jsonb_path_exists(j, '$.is_anonymous') and j ->> 'is_anonymous' not in ('false', 'f'))
                         or (jsonb_path_exists(j, '$.is_sso_user') and j ->> 'is_sso_user' not in ('false', 'f')) from adm) then 'FAIL'
              when (select jsonb_path_exists(j, '$.deleted_at') and jsonb_path_exists(j, '$.banned_until') and jsonb_path_exists(j, '$.is_anonymous') and jsonb_path_exists(j, '$.is_sso_user') from adm) then 'PASS'
              else 'INCONCLUSIVE' end,
         'A flagged attribute fails. INCONCLUSIVE means some of these columns are not exposed here: confirm in the Dashboard that the user is active, not banned, and an email-and-password user.'
  union all
  -- ------------------------------------------------------------------------------------------ privileges (grants, incl. column level)
  select 7, 'anon and authenticated cannot EXECUTE private.provision_administrator(uuid)',
         case when to_regprocedure('private.provision_administrator(uuid)') is null then 'FAIL'
              when not has_function_privilege('anon', 'private.provision_administrator(uuid)', 'EXECUTE')
               and not has_function_privilege('authenticated', 'private.provision_administrator(uuid)', 'EXECUTE') then 'PASS' else 'FAIL' end,
         'has_function_privilege for both roles (includes PUBLIC and inherited grants).'
  union all
  select 8, 'anon and authenticated have no INSERT (table OR any column) on public.profiles',
         case when to_regclass('public.profiles') is null then 'FAIL'
              when not (has_table_privilege('anon', 'public.profiles', 'INSERT') or has_any_column_privilege('anon', 'public.profiles', 'INSERT')
                     or has_table_privilege('authenticated', 'public.profiles', 'INSERT') or has_any_column_privilege('authenticated', 'public.profiles', 'INSERT')) then 'PASS' else 'FAIL' end,
         'Table-level and column-level INSERT privileges are both examined.'
  union all
  select 9, 'anon and authenticated have no UPDATE (table OR any column) on public.profiles',
         case when to_regclass('public.profiles') is null then 'FAIL'
              when not (has_table_privilege('anon', 'public.profiles', 'UPDATE') or has_any_column_privilege('anon', 'public.profiles', 'UPDATE')
                     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE') or has_any_column_privilege('authenticated', 'public.profiles', 'UPDATE')) then 'PASS' else 'FAIL' end,
         'Table-level and column-level UPDATE privileges are both examined (a column-level grant on "role" would be a role-assignment hole).'
  union all
  select 10, 'anon and authenticated have no DELETE or TRUNCATE on public.profiles',
         case when to_regclass('public.profiles') is null then 'FAIL'
              when not (has_table_privilege('anon', 'public.profiles', 'DELETE') or has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
                     or has_table_privilege('authenticated', 'public.profiles', 'DELETE') or has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')) then 'PASS' else 'FAIL' end,
         'DELETE and TRUNCATE exist only at table level.'
  union all
  select 11, 'anon has no SELECT (table or any column) on public.profiles',
         case when to_regclass('public.profiles') is null then 'FAIL'
              when not (has_table_privilege('anon', 'public.profiles', 'SELECT') or has_any_column_privilege('anon', 'public.profiles', 'SELECT')) then 'PASS' else 'FAIL' end,
         'Anonymous visitors must read nothing from profiles.'
  union all
  select 12, 'authenticated CAN read the columns the login needs (profiles.id and profiles.role)',
         case when to_regclass('public.profiles') is null then 'FAIL'
              when has_column_privilege('authenticated', 'public.profiles', 'id', 'SELECT') and has_column_privilege('authenticated', 'public.profiles', 'role', 'SELECT') then 'PASS' else 'FAIL' end,
         'The sign-in check selects role filtered by id. Without this the administrator could never get past login.'
  union all
  select 13, 'anon and authenticated have no USAGE on schema private',
         case when not has_schema_privilege('anon', 'private', 'usage') and not has_schema_privilege('authenticated', 'private', 'usage') then 'PASS' else 'FAIL' end,
         'Migration 20261011160001. (They keep EXECUTE on private.is_admin() only, which RLS policies need.)'
  union all
  -- ------------------------------------------------------------------------------------------ RLS and structural protections (catalog definitions)
  select 14, 'RLS is enabled on public.profiles and the only policy is profiles_select_own (SELECT, authenticated)',
         case when coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.profiles')), false)
                and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles') = 1
                and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                              and policyname = 'profiles_select_own' and cmd = 'SELECT' and roles = array['authenticated']::name[]) then 'PASS' else 'FAIL' end,
         'Definitions only: they show what is configured, not how a request behaves. Grants (rows 8 to 12) and policies are separate layers.'
  union all
  select 15, 'single-administrator unique index and profile guard trigger are present',
         case when exists (select 1 from pg_index i join pg_class ic on ic.oid = i.indexrelid
                           where i.indrelid = to_regclass('public.profiles') and ic.relname = 'profiles_single_admin' and i.indisunique and i.indisvalid)
                and exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('public.profiles') and t.tgname = 'profiles_guard_write'
                              and not t.tgisinternal and t.tgenabled = 'O') then 'PASS' else 'FAIL' end,
         'profiles_single_admin and profiles_guard_write read from the catalog.'
)

select n as "#", name as "check", result, detail
from (
  select n, name, result, detail from checks
  union all
  select 99, 'OVERALL',
         case when bool_or(result = 'FAIL') then 'FAIL' when bool_or(result = 'INCONCLUSIVE') then 'INCONCLUSIVE' else 'PASS' end,
         case when bool_or(result = 'FAIL') then 'At least one check failed. Do not use the administrator account until it is fixed.'
              when bool_or(result = 'INCONCLUSIVE') then 'Nothing failed, but some checks need the inputs or manual Dashboard verification described in their detail.'
              else 'All database-side checks passed. Still prove it end to end: sign in at /admin, then run verify-public-api.mjs.' end
  from checks
) all_rows
order by n;
