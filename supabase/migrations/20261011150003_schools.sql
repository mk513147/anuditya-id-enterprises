-- Phase A / 3 of 11: schools (mirrors `School` in src/types/index.ts).

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 100),
  -- URL-safe identifier used in /school/:slug. Not a secret. Stored lower-case.
  slug text not null check (slug = lower(slug) and char_length(slug) between 3 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Short internal code, e.g. STM-001. Stored upper-case.
  code text not null check (code = upper(code) and code ~ '^[A-Z0-9-]{2,12}$'),
  contact_person text not null check (char_length(btrim(contact_person)) between 2 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or (char_length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  address text check (address is null or char_length(address) <= 250),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schools enable row level security;
revoke all on table public.schools from anon, authenticated;

-- Uniqueness the mock enforces (case-insensitive code and slug).
create unique index schools_code_key on public.schools (lower(code));
create unique index schools_slug_key on public.schools (lower(slug));
-- Admin search matches name or code (partial, case-insensitive).
create index schools_name_trgm on public.schools using gin (name extensions.gin_trgm_ops);
create index schools_code_trgm on public.schools using gin (code extensions.gin_trgm_ops);
create index schools_active_idx on public.schools (is_active);

create trigger schools_touch_updated_at before update on public.schools
  for each row execute function private.touch_updated_at();
