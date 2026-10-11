-- Structural security checks over the whole schema. Read-only: it creates no data.
-- Run with `supabase test db` (pgTAP) against a LOCAL database. See docs/supabase/testing.md.
begin;
select plan(28);

-- RLS --------------------------------------------------------------------------------------------------------------
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity)::int,
  0, 'every table in public has Row Level Security enabled');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects' and c.relrowsecurity)::int,
  1, 'storage.objects has Row Level Security enabled');

select is(
  (select count(*) from pg_tables where schemaname = 'public')::int,
  9, 'exactly the nine expected tables exist (a new table must be reviewed and added to this test)');

-- Anonymous role: no direct table or column access at all -------------------------------------------------------------
select is(
  (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public')::int,
  0, 'anon holds no table privileges in public');
select is(
  (select count(*) from information_schema.role_column_grants where grantee = 'anon' and table_schema = 'public')::int,
  0, 'anon holds no column privileges in public');
select is(
  (select count(*) from information_schema.role_usage_grants where grantee = 'anon' and object_schema = 'public' and object_type = 'SEQUENCE')::int,
  0, 'anon holds no sequence privileges in public');

-- Authenticated role: never able to delete, and no write access to protected tables ---------------------------------
select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'))::int,
  0, 'authenticated can never DELETE or TRUNCATE any public table');
select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'INSERT'
      and table_name in ('profiles', 'students', 'orders', 'order_status_history', 'uploaded_files', 'feedback'))::int,
  0, 'authenticated cannot INSERT into profiles, students, orders, history, files or feedback');
select is(
  (select count(*) from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'UPDATE'
      and table_name in ('profiles', 'orders', 'order_status_history', 'uploaded_files'))::int,
  0, 'authenticated cannot UPDATE profiles, orders, history or file records directly');
select is(
  (select count(*) from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and table_name = 'students'
      and privilege_type = 'UPDATE'
      and column_name in ('reference_no', 'school_id', 'submitted_at', 'approval_status', 'reviewed_at', 'photo_path', 'id'))::int,
  0, 'authenticated cannot UPDATE the protected student columns');
select is(
  (select count(*) from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and table_name = 'orders' and column_name = 'tracking_secret_hash')::int,
  0, 'nobody but the owner and service role can even read orders.tracking_secret_hash');
select is(
  (select count(*) from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and table_name = 'profiles' and privilege_type <> 'SELECT')::int,
  0, 'authenticated can only SELECT from profiles');

-- Functions ------------------------------------------------------------------------------------------------------------
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['list_active_schools', 'list_approved_feedback', 'list_enabled_services', 'list_published_advertisements',
        'resolve_school', 'submit_feedback', 'submit_file_upload', 'submit_student', 'track_order'],
  'anon can execute exactly the nine intended public functions');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' and has_function_privilege('authenticated', p.oid, 'execute')),
  array['admin_create_order', 'admin_review_student', 'admin_rotate_tracking_code', 'admin_set_order_status', 'admin_summary'],
  'authenticated can execute the five administrator functions (each re-checks is_admin)');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute'))::int,
  0, 'anon cannot execute any administrator function');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=""%')::int,
  0, 'every SECURITY DEFINER function fixes an empty search_path');
select is(has_schema_privilege('anon', 'private', 'usage') or has_schema_privilege('authenticated', 'private', 'usage'), false,
  'anon and authenticated have no USAGE on the private schema (policies and triggers do not need it)');
select is(has_schema_privilege('service_role', 'private', 'usage'), true, 'service_role keeps USAGE on the private schema');
select is(has_function_privilege('authenticated', 'private.is_admin()', 'execute'), true,
  'authenticated keeps EXECUTE on is_admin() (RLS policies check EXECUTE when they run); this is separate from schema USAGE');
select is(
  has_function_privilege('anon', 'private.provision_administrator(uuid)', 'execute')
    or has_function_privilege('authenticated', 'private.provision_administrator(uuid)', 'execute'),
  false, 'no client role can run private.provision_administrator');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname <> 'is_admin' and has_function_privilege('anon', p.oid, 'execute'))::int,
  0, 'anon can execute nothing in the private schema except is_admin()');

-- Public function results never carry private columns -----------------------------------------------------------------
select is(pg_get_function_result('public.list_active_schools()'::regprocedure), 'TABLE(id uuid, name text)',
  'public school list returns only id and name (no contact details)');
select is(pg_get_function_result('public.resolve_school(text)'::regprocedure), 'TABLE(status text, school_id uuid, name text, slug text)',
  'school lookup by slug returns only status, id, name and slug');
select is(pg_get_function_result('public.track_order(text,text)'::regprocedure),
  'TABLE(order_no text, customer_name text, service text, quantity integer, status order_status, order_date date, expected_delivery date)',
  'order tracking returns only the whitelisted columns (no notes, id, history or hash)');
select is((select provolatile from pg_proc where oid = 'public.track_order(text,text)'::regprocedure), 'v',
  'order tracking is VOLATILE, so PostgREST accepts POST only and the tracking code can never travel in a URL query string');
select is(pg_get_function_arguments('public.submit_student(uuid,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure) ~* 'status|approval|reviewed|reference', false,
  'submit_student accepts no status, approval or reference-number argument');

-- Storage ---------------------------------------------------------------------------------------------------------------
select is((select count(*) from storage.buckets where public)::int, 0, 'no storage bucket is public');
select is((select count(*) from storage.buckets where id in ('student-photos', 'school-uploads') and not public)::int, 2,
  'both private buckets exist');

select * from finish();
rollback;
