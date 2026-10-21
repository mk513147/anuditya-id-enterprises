-- READ-ONLY readiness check before provisioning the single administrator.
-- Run in the Supabase Dashboard SQL editor (as the project owner). It is ONE SELECT statement: it changes nothing.
-- It is not a migration and is never run automatically.
--
-- OPTIONAL: to also check the Auth user you intend to promote, replace the two placeholders in the first CTE below (the UID
-- from Authentication > Users, and the administrator's email). Leave them as they are to skip those rows (they report INCONCLUSIVE).
--
-- Every row is PASS, FAIL or INCONCLUSIVE:
--   PASS          the condition was actually tested and holds.
--   FAIL          the condition was actually tested and does not hold. Do not provision until it is fixed.
--   INCONCLUSIVE  SQL cannot determine it (missing input, or an attribute this project's auth.users does not expose). The
--                 detail column says how to verify it by hand in the Dashboard.
-- A last row, OVERALL READINESS, is FAIL if any row failed, otherwise INCONCLUSIVE if any row was inconclusive, otherwise PASS.
-- Provision only on PASS, or on INCONCLUSIVE after doing every manual verification the detail columns ask for.

with
cfg as (
  select
    case when '<ADMIN_AUTH_USER_UID>'    like '<%' then null else lower(btrim('<ADMIN_AUTH_USER_UID>')) end as uid,
    case when '<INTENDED_ADMIN_EMAIL>'   like '<%' then null else lower(btrim('<INTENDED_ADMIN_EMAIL>')) end as email
),

-- The 16 migration versions in this repository (supabase/migrations/), in order. A repository test keeps this list in sync.
expected as (
  select array[
    '20261011150001', '20261011150002', '20261011150003', '20261011150004', '20261011150005', '20261011150006',
    '20261011150007', '20261011150008', '20261011150009', '20261011150010', '20261011150011', '20261011160001',
    '20261012090001', '20261013090001', '20261014090001', '20261015090001'
  ]::text[] as versions
),

-- Reads the applied versions only if the history table exists (a plain reference would make the whole statement fail).
hist as (
  select
    to_regclass('supabase_migrations.schema_migrations') is not null as has_table,
    case when to_regclass('supabase_migrations.schema_migrations') is not null then (
      select coalesce(array_agg(q.v order by q.v), '{}'::text[])
      from (
        select (xpath('/row/version/text()', x))[1]::text as v
        from unnest(xpath('/table/row', query_to_xml('select version from supabase_migrations.schema_migrations', false, false, ''))) as x
      ) q
    ) end as applied
),

-- The chosen Auth user, as JSON so that a column this project does not have simply reads as "absent" instead of failing.
sel as (
  select to_jsonb(u) as j from auth.users u where u.id::text = (select uid from cfg)
),
cnt as (select count(*) as n from auth.users),

checks(n, name, result, detail) as (
  -- ------------------------------------------------------------------------------------------ migrations
  select 1, 'migration history table exists',
         case when h.has_table then 'PASS' else 'INCONCLUSIVE' end,
         case when h.has_table then 'supabase_migrations.schema_migrations found.'
              else 'Not found. Check Dashboard > Database > Migrations (or run: npx supabase migration list --linked) and confirm the 16 versions by hand.' end
  from hist h
  union all
  select 2, 'applied migrations are exactly the 16 expected versions, no missing and no unexpected',
         case when not h.has_table then 'INCONCLUSIVE' when h.applied = e.versions then 'PASS' else 'FAIL' end,
         case when not h.has_table then 'Cannot read the history table; verify by hand.'
              when h.applied = e.versions then '12 versions, identical to supabase/migrations/. (Only the version set and its order are comparable; apply timestamps are not recorded here.)'
              else 'MISSING: ' || coalesce((select string_agg(x, ', ' order by x) from unnest(e.versions) x where x <> all (h.applied)), 'none')
                || ' | UNEXPECTED: ' || coalesce((select string_agg(x, ', ' order by x) from unnest(h.applied) x where x <> all (e.versions)), 'none') end
  from hist h, expected e
  union all
  -- ------------------------------------------------------------------------------------------ function
  select 3, 'private.provision_administrator(uuid) exists, SECURITY DEFINER, empty search_path, returns void',
         case when to_regprocedure('private.provision_administrator(uuid)') is null then 'FAIL'
              when coalesce((select p.prosecdef and p.prorettype = 'void'::regtype and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=""%'
                             from pg_proc p where p.oid = to_regprocedure('private.provision_administrator(uuid)')), false) then 'PASS'
              else 'FAIL' end,
         'Exact signature (uuid) looked up in the catalog; definer flag, return type and fixed search_path checked.'
  union all
  select 4, 'unique index profiles_single_admin on public.profiles(role) WHERE role = admin',
         case when exists (
           select 1
           from pg_index i
           join pg_class ic on ic.oid = i.indexrelid
           where i.indrelid = to_regclass('public.profiles')
             and ic.relname = 'profiles_single_admin'
             and i.indisunique and i.indisvalid and i.indnatts = 1
             and (select a.attname from pg_attribute a where a.attrelid = i.indrelid and a.attnum = i.indkey[0]) = 'role'
             and pg_get_expr(i.indpred, i.indrelid) like '%admin%'
         ) then 'PASS' else 'FAIL' end,
         'Index definition read from the catalog (unique, valid, one column "role", partial on admin).'
  union all
  select 5, 'trigger profiles_guard_write (BEFORE INSERT OR UPDATE, per row, enabled) on public.profiles',
         case when exists (
           select 1 from pg_trigger t
           where t.tgrelid = to_regclass('public.profiles') and t.tgname = 'profiles_guard_write'
             and not t.tgisinternal and t.tgenabled = 'O'
             and (t.tgtype & 1) <> 0 and (t.tgtype & 2) <> 0 and (t.tgtype & 4) <> 0 and (t.tgtype & 16) <> 0
         ) then 'PASS' else 'FAIL' end,
         'Trigger flags read from the catalog (row-level, before, insert, update; enabled for normal sessions).'
  union all
  select 6, 'row level security is enabled on public.profiles',
         case when coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.profiles')), false) then 'PASS' else 'FAIL' end,
         'pg_class.relrowsecurity. This is a switch only; policies are checked in the next row.'
  union all
  select 7, 'profiles has exactly one policy: profiles_select_own, SELECT, authenticated only',
         case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles') = 1
                and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                              and policyname = 'profiles_select_own' and cmd = 'SELECT' and roles = array['authenticated']::name[])
              then 'PASS' else 'FAIL' end,
         'Policy list read from pg_policies. No write policy may exist. Policies plus grants do not prove runtime behaviour; the sign-in test does.'
  union all
  select 8, 'anon and authenticated have no USAGE on schema private',
         case when not has_schema_privilege('anon', 'private', 'usage') and not has_schema_privilege('authenticated', 'private', 'usage') then 'PASS' else 'FAIL' end,
         'has_schema_privilege for both roles (this is what migration 20261011160001 revokes).'
  union all
  -- ------------------------------------------------------------------------------------------ session and users
  select 9, 'this SQL session carries no user token (auth.uid() is null)',
         case when auth.uid() is null then 'PASS' else 'FAIL' end,
         'The profile guard trigger refuses to create a profile while a user token is present, so provisioning needs this to be null.'
  union all
  select 10, 'exactly one Auth user exists',
         case when c.n = 1 then 'PASS' else 'FAIL' end,
         c.n || ' user(s) in auth.users (soft-deleted ones included). Create exactly one administrator user; investigate and remove any other.'
  from cnt c
  union all
  select 11, 'no administrator profile exists yet',
         case when (select count(*) from public.profiles where role = 'admin') = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from public.profiles where role = 'admin') || ' administrator profile(s). If 1, the administrator is already provisioned: run 03_verify_administrator.sql, not 02.'
  union all
  -- ------------------------------------------------------------------------------------------ the chosen Auth user (optional)
  select 12, 'UID supplied and well-formed',
         case when c.uid is null then 'INCONCLUSIVE'
              when c.uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then 'PASS' else 'FAIL' end,
         case when c.uid is null then 'No UID given in the first CTE; the user-specific rows below cannot be checked. Verify the user in the Dashboard.' else 'Format check only.' end
  from cfg c
  union all
  select 13, 'a user with that UID exists',
         case when c.uid is null then 'INCONCLUSIVE' when exists (select 1 from sel) then 'PASS' else 'FAIL' end,
         'auth.users looked up by the supplied UID.'
  from cfg c
  union all
  select 14, 'that user''s email equals the intended administrator email',
         case when c.uid is null or c.email is null then 'INCONCLUSIVE'
              when not exists (select 1 from sel) then 'FAIL'
              when lower(btrim(coalesce((select j ->> 'email' from sel), ''))) = c.email then 'PASS' else 'FAIL' end,
         case when c.email is null then 'No intended email given; compare the email shown in Authentication > Users with the administrator''s real address yourself.' else 'Case-insensitive comparison with the email you typed.' end
  from cfg c
  union all
  select 15, 'that user''s email is confirmed',
         case when c.uid is null then 'INCONCLUSIVE' when not exists (select 1 from sel) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.email_confirmed_at') from sel) then 'INCONCLUSIVE'
              when (select j ->> 'email_confirmed_at' from sel) is not null then 'PASS' else 'FAIL' end,
         'Reads email_confirmed_at. INCONCLUSIVE means the column is not exposed: check the user shows as confirmed in Authentication > Users.'
  from cfg c
  union all
  select 16, 'that user is not deleted (soft delete)',
         case when c.uid is null then 'INCONCLUSIVE' when not exists (select 1 from sel) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.deleted_at') from sel) then 'INCONCLUSIVE'
              when (select j ->> 'deleted_at' from sel) is null then 'PASS' else 'FAIL' end,
         'Reads deleted_at. INCONCLUSIVE means the column is not exposed: confirm in the Dashboard that the user is active.'
  from cfg c
  union all
  select 17, 'that user is not banned',
         case when c.uid is null then 'INCONCLUSIVE' when not exists (select 1 from sel) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.banned_until') from sel) then 'INCONCLUSIVE'
              when (select j ->> 'banned_until' from sel) is null or (select (j ->> 'banned_until')::timestamptz from sel) <= now() then 'PASS' else 'FAIL' end,
         'Reads banned_until. INCONCLUSIVE means the column is not exposed: confirm in the Dashboard that the user is not banned.'
  from cfg c
  union all
  select 18, 'that user is not anonymous',
         case when c.uid is null then 'INCONCLUSIVE' when not exists (select 1 from sel) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.is_anonymous') from sel) then 'INCONCLUSIVE'
              when (select j ->> 'is_anonymous' from sel) in ('false', 'f') then 'PASS' else 'FAIL' end,
         'Reads is_anonymous. INCONCLUSIVE means the column is not exposed: the user must have an email and password, not be an anonymous sign-in.'
  from cfg c
  union all
  select 19, 'that user is not a single-sign-on user',
         case when c.uid is null then 'INCONCLUSIVE' when not exists (select 1 from sel) then 'FAIL'
              when not (select jsonb_path_exists(j, '$.is_sso_user') from sel) then 'INCONCLUSIVE'
              when (select j ->> 'is_sso_user' from sel) in ('false', 'f') then 'PASS' else 'FAIL' end,
         'Reads is_sso_user. INCONCLUSIVE means the column is not exposed: the user must be an email-and-password user.'
  from cfg c
)

select n as "#", name as "check", result, detail
from (
  select n, name, result, detail from checks
  union all
  select 99, 'OVERALL READINESS',
         case when bool_or(result = 'FAIL') then 'FAIL' when bool_or(result = 'INCONCLUSIVE') then 'INCONCLUSIVE' else 'PASS' end,
         case when bool_or(result = 'FAIL') then 'At least one check failed. Do not provision.'
              when bool_or(result = 'INCONCLUSIVE') then 'Nothing failed, but some checks could not be determined in SQL. Do their manual verification before provisioning.'
              else 'All checks passed.' end
  from checks
) all_rows
order by n;
