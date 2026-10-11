-- Phase A / 1 of 11: foundation.
-- Extensions, the non-exposed `private` schema, enums, shared trigger helpers and reference-number sequences.
-- DRAFT: reviewed and tested locally only. Not applied to any remote database.

-- Extensions are installed in the `extensions` schema, as on Supabase.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- `private` holds helpers and sequences. It must NEVER be added to the API's exposed schemas
-- (supabase/config.toml [api] schemas), so nothing in it is reachable through the REST/RPC API.
create schema if not exists private;
revoke all on schema private from public;
-- RLS policies and CHECK/trigger functions run as the calling role, so that role needs USAGE on the schema.
-- Having USAGE alone does not allow calling anything: every function below grants EXECUTE explicitly.
grant usage on schema private to anon, authenticated, service_role;

-- Default-deny: objects created later in `public` are NOT automatically reachable by the API roles.
-- Every table and function therefore needs an explicit GRANT in these migrations.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Domain enums (values mirror src/types/index.ts).
create type public.app_role as enum ('admin');
create type public.order_status as enum (
  'Order Received', 'Data Verification', 'Designing', 'Printing', 'Quality Check', 'Ready', 'Dispatched', 'Delivered'
);
create type public.feedback_status as enum ('pending', 'approved', 'rejected');
create type public.file_type as enum ('xlsx', 'xls', 'csv');
create type public.service_category as enum ('id-cards', 'school-materials', 'design-printing');
-- New (business requirement): student submissions start as pending and need administrator approval.
create type public.student_approval_status as enum ('pending', 'approved', 'rejected');

-- Keeps updated_at honest on every UPDATE.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public;

-- Reference numbers. One global, never-resetting sequence per kind, which matches today's mock (which numbers by
-- row count and never resets by year). Sequences can leave gaps after a rolled-back insert; numbers are never reused.
-- The year part is the IST calendar year of generation. See docs/supabase/decisions.md (D-REF).
create sequence private.student_reference_seq;
create sequence private.file_reference_seq;
create sequence private.order_number_seq;

create function private.format_reference(p_prefix text, p_number bigint, p_width integer)
returns text
language sql
stable
set search_path = ''
as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(p_number::text, p_width, '0')
$$;
revoke all on function private.format_reference(text, bigint, integer) from public;
grant execute on function private.format_reference(text, bigint, integer) to service_role;
