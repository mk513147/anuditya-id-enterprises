-- Phase A / 7 of 11: services, advertisements and feedback.
-- Public reads happen only through the narrowly scoped functions in 0009; clients get no direct table access.

-- ---------------------------------------------------------------- services (mirrors `Service`)
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title text not null check (char_length(btrim(title)) between 3 and 60),
  tagline text not null check (char_length(btrim(tagline)) between 2 and 40),
  category public.service_category not null,
  description text not null check (char_length(btrim(description)) between 10 and 250),
  -- A link, not an uploaded file. The existing rule accepts http and https; tightening to https is decision D-IMG.
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~* '^https?://[^[:space:]]+$')),
  icon text not null check (icon in (
    'id-card', 'users', 'school', 'graduation', 'ribbon', 'diary', 'magazine', 'prospectus',
    'camera', 'pen-tool', 'banner', 'printer', 'receipt', 'truck'
  )),
  -- Disabled services never appear in public lists or in the quote form.
  enabled boolean not null default true,
  -- Position on the public pages. Not unique (like the mock); filled with max+1 when omitted.
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.services enable row level security;
revoke all on table public.services from anon, authenticated;

-- Names are what quotes and WhatsApp messages refer to, so they must be unique (ignoring case and spacing).
create unique index services_title_key on public.services (lower(regexp_replace(btrim(title), '\s+', ' ', 'g')));
create index services_enabled_order_idx on public.services (enabled, display_order);
create index services_category_idx on public.services (category);
create index services_title_trgm on public.services using gin (title extensions.gin_trgm_ops);

create function private.services_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_order is null then
    select coalesce(max(s.display_order), 0) + 1 into new.display_order from public.services s;
  end if;
  return new;
end;
$$;
revoke all on function private.services_before_insert() from public;
create trigger services_before_insert before insert on public.services
  for each row execute function private.services_before_insert();

create trigger services_touch_updated_at before update on public.services
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- advertisements (mirrors `Advertisement`)
create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null check (char_length(btrim(description)) between 10 and 300),
  offer text check (offer is null or char_length(offer) between 1 and 60),
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~* '^https?://[^[:space:]]+$')),
  icon text not null check (icon in (
    'id-card', 'ribbon', 'diary', 'magazine', 'prospectus', 'banner', 'pen-tool', 'printer',
    'school', 'graduation', 'camera', 'receipt', 'truck'
  )),
  whatsapp_message text not null check (char_length(btrim(whatsapp_message)) between 2 and 120),
  -- Two separate switches, as in the app: enabled by an admin, and published (not a draft).
  active boolean not null default true,
  is_published boolean not null default false,
  -- Optional visibility window, stored as instants. The admin UI picks India calendar days:
  -- a start day begins 00:00 IST and an end day lasts until 23:59:59 IST.
  starts_at timestamptz,
  ends_at timestamptz,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertisements_schedule_order check (starts_at is null or ends_at is null or ends_at >= starts_at)
);
alter table public.advertisements enable row level security;
revoke all on table public.advertisements from anon, authenticated;
create index advertisements_visibility_idx on public.advertisements (is_published, active, starts_at, ends_at);
create index advertisements_title_trgm on public.advertisements using gin (title extensions.gin_trgm_ops);

create trigger advertisements_touch_updated_at before update on public.advertisements
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- feedback (mirrors `Feedback`)
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  organization text check (organization is null or char_length(organization) between 1 and 100),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 10 and 600),
  -- New feedback is always pending (forced by submit_feedback). Only approved feedback is public.
  status public.feedback_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;
create index feedback_status_created_idx on public.feedback (status, created_at desc);
create index feedback_rating_idx on public.feedback (rating);
create index feedback_name_trgm on public.feedback using gin (name extensions.gin_trgm_ops);
create index feedback_message_trgm on public.feedback using gin (message extensions.gin_trgm_ops);

create trigger feedback_touch_updated_at before update on public.feedback
  for each row execute function private.touch_updated_at();
