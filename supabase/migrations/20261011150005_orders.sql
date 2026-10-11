-- Phase A / 5 of 11: orders, status history and the secret tracking code.
-- Orders belong to SCHOOLS, not to individual students (verified in src/types/index.ts).

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- JOB-YYYY-NNNN. Generated when not supplied (a legacy number may be imported by the owner).
  order_no text not null unique check (order_no ~ '^[A-Z0-9][A-Z0-9-]{4,29}$'),
  -- Optional, like the existing model (`schoolId?`). See docs/supabase/decisions.md (D-ORD-SCHOOL).
  school_id uuid references public.schools (id) on delete restrict,
  -- Display name shown to the customer. Kept in step with the school's name by a trigger (as the mock does).
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 100),
  -- Free text today (the existing model has no link to Services).
  service text not null check (char_length(btrim(service)) between 1 and 100),
  quantity integer not null check (quantity > 0),
  status public.order_status not null default 'Order Received',
  order_date date not null,
  expected_delivery date not null,
  -- Internal: never returned by any public function.
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 1000),
  -- SHA-256 of (order id || ':' || secret tracking code). The plaintext code is never stored; see track_order in 0010.
  -- Null = the order cannot be tracked publicly until a code is issued.
  tracking_secret_hash bytea check (tracking_secret_hash is null or octet_length(tracking_secret_hash) = 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;

create index orders_status_idx on public.orders (status);
create index orders_order_date_idx on public.orders (order_date desc, order_no desc);
create index orders_school_idx on public.orders (school_id);
create index orders_order_no_trgm on public.orders using gin (order_no extensions.gin_trgm_ops);

create function private.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_no is null then
    new.order_no := private.format_reference('JOB', nextval('private.order_number_seq'), 4);
  end if;
  return new;
end;
$$;
revoke all on function private.orders_before_insert() from public;
-- order_no is NOT NULL, but BEFORE triggers run before the constraint is checked, so it may be omitted on insert.
create trigger orders_before_insert before insert on public.orders
  for each row execute function private.orders_before_insert();

-- The order number never changes.
create function private.orders_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_no is distinct from old.order_no then
    raise exception 'the order number cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.orders_guard_update() from public;
create trigger orders_guard_update before update on public.orders
  for each row execute function private.orders_guard_update();

create trigger orders_touch_updated_at before update on public.orders
  for each row execute function private.touch_updated_at();

-- Status history: every change of status is recorded atomically with the change itself.
-- Matches the mock (changes only; the order date stands for "placed"). Initial status is NOT logged. See D-HIST.
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  status public.order_status not null,
  changed_at timestamptz not null default now()
);
alter table public.order_status_history enable row level security;
revoke all on table public.order_status_history from anon, authenticated;
create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

create function private.orders_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_status_history (order_id, status) values (new.id, new.status);
  return new;
end;
$$;
revoke all on function private.orders_log_status_change() from public;
create trigger orders_log_status_change after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function private.orders_log_status_change();

-- Renaming a school keeps the display name on its orders in step (the mock does the same).
create function private.schools_sync_order_customer_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set customer_name = new.name where school_id = new.id;
  return new;
end;
$$;
revoke all on function private.schools_sync_order_customer_name() from public;
create trigger schools_sync_order_customer_name after update of name on public.schools
  for each row when (old.name is distinct from new.name)
  execute function private.schools_sync_order_customer_name();
