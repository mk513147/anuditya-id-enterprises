-- Local stand-in for the parts of a Supabase project that the migrations depend on.
-- (Roles, auth.users/auth.uid(), storage.buckets/objects with RLS.) NOT a replacement for testing on real Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- Supabase's own default privileges: new objects in public are open to the API roles. The migrations must undo that.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
-- The attribute columns below mirror what Supabase's auth.users is believed to expose; the provisioning scripts read them as
-- JSON, so a project without one of them reports INCONCLUSIVE instead of failing (that case is tested by dropping columns).
create table auth.users (
  id uuid primary key, email text, created_at timestamptz default now(), email_confirmed_at timestamptz,
  deleted_at timestamptz, banned_until timestamptz, is_anonymous boolean not null default false, is_sso_user boolean not null default false
);

-- Supabase CLI's migration history table (the test harness fills it with the versions it applies).
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
-- Supabase grants these broadly and relies on RLS; do the same so the policies are what is under test.
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Minimal pgTAP-compatible assertions (plan, ok, is, isnt, throws_ok, lives_ok, is_empty, finish).
create schema pgtap_shim;
create table pgtap_shim.results (n serial primary key, passed boolean not null, description text, detail text);
grant usage on schema pgtap_shim to public;
grant all on pgtap_shim.results to public;
grant usage, select on sequence pgtap_shim.results_n_seq to public;
create function pgtap_shim.plan(p_count integer) returns text language plpgsql as $$
begin
  delete from pgtap_shim.results;
  perform setval('pgtap_shim.results_n_seq', 1, false);
  perform set_config('pgtap_shim.plan', p_count::text, false);
  return '1..' || p_count;
end $$;
create function pgtap_shim.ok(p_test boolean, p_desc text default '') returns text language plpgsql as $$
begin
  insert into pgtap_shim.results (passed, description) values (coalesce(p_test, false), p_desc);
  return case when coalesce(p_test, false) then 'ok' else 'not ok' end || ' - ' || p_desc;
end $$;
create function pgtap_shim.is(p_got anyelement, p_want anyelement, p_desc text default '') returns text language plpgsql as $$
declare v_ok boolean := p_got is not distinct from p_want;
begin
  insert into pgtap_shim.results (passed, description, detail)
  values (v_ok, p_desc, case when v_ok then null else format('got: %L / want: %L', p_got, p_want) end);
  return case when v_ok then 'ok' else 'not ok' end || ' - ' || p_desc;
end $$;
create function pgtap_shim.isnt(p_got anyelement, p_want anyelement, p_desc text default '') returns text language plpgsql as $$
declare v_ok boolean := p_got is distinct from p_want;
begin
  insert into pgtap_shim.results (passed, description, detail) values (v_ok, p_desc, case when v_ok then null else format('both: %L', p_got) end);
  return case when v_ok then 'ok' else 'not ok' end || ' - ' || p_desc;
end $$;
create function pgtap_shim.lives_ok(p_sql text, p_desc text default '') returns text language plpgsql as $$
declare v_state text; v_msg text;
begin
  begin
    execute p_sql;
    insert into pgtap_shim.results (passed, description) values (true, p_desc);
    return 'ok - ' || p_desc;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    insert into pgtap_shim.results (passed, description, detail) values (false, p_desc, format('threw %s: %s', v_state, v_msg));
    return 'not ok - ' || p_desc;
  end;
end $$;
create function pgtap_shim.throws_ok(p_sql text, p_errcode text, p_errmsg text, p_desc text default '') returns text language plpgsql as $$
declare v_state text; v_msg text; v_ok boolean;
begin
  begin
    execute p_sql;
    insert into pgtap_shim.results (passed, description, detail) values (false, p_desc, 'no exception was thrown');
    return 'not ok - ' || p_desc;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    v_ok := (p_errcode is null or v_state = p_errcode) and (p_errmsg is null or v_msg = p_errmsg);
    insert into pgtap_shim.results (passed, description, detail)
    values (v_ok, p_desc, case when v_ok then null else format('threw %s: %s (wanted %L / %L)', v_state, v_msg, p_errcode, p_errmsg) end);
    return case when v_ok then 'ok' else 'not ok' end || ' - ' || p_desc;
  end;
end $$;
create function pgtap_shim.is_empty(p_sql text, p_desc text default '') returns text language plpgsql as $$
declare v_count bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into v_count;
  insert into pgtap_shim.results (passed, description, detail) values (v_count = 0, p_desc, case when v_count = 0 then null else v_count || ' row(s)' end);
  return case when v_count = 0 then 'ok' else 'not ok' end || ' - ' || p_desc;
end $$;
create function pgtap_shim.finish() returns setof text language plpgsql as $$
declare r record; v_plan integer := nullif(current_setting('pgtap_shim.plan', true), '')::integer; v_total integer; v_failed integer;
begin
  select count(*), count(*) filter (where not passed) into v_total, v_failed from pgtap_shim.results;
  for r in select * from pgtap_shim.results order by n loop
    return next case when r.passed then 'ok ' else 'not ok ' end || r.n || ' - ' || coalesce(r.description, '') || coalesce('   # ' || r.detail, '');
  end loop;
  if v_plan is not null and v_plan <> v_total then
    return next format('# Looks like you planned %s tests but ran %s', v_plan, v_total);
    v_failed := v_failed + 1;
  end if;
  return next format('# summary: %s ran, %s failed', v_total, v_failed);
end $$;
grant execute on all functions in schema pgtap_shim to public;
