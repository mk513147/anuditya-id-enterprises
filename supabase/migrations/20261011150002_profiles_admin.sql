-- Phase A / 2 of 11: the single administrator.
-- Exactly one administrator, provisioned by the database owner. No signup path, no staff roles, no client writes.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;

-- At most ONE administrator row can ever exist (a unique index over the role among admin rows).
create unique index profiles_single_admin on public.profiles (role) where role = 'admin';

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Defence in depth (the real barrier is that no client role has INSERT/UPDATE/DELETE privilege or policy):
-- a profile can only be created when there is no authenticated end-user in the session, i.e. by the database
-- owner (SQL editor / migration) or the service role, never by a request carrying a user's token.
create function private.guard_profile_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      raise exception 'profiles can only be provisioned by the database owner' using errcode = '42501';
    end if;
    return new;
  end if;
  -- UPDATE: identity and role are immutable.
  if new.id is distinct from old.id or new.role is distinct from old.role then
    raise exception 'profile id and role cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_write() from public;

create trigger profiles_guard_write before insert or update on public.profiles
  for each row execute function private.guard_profile_write();

-- True only for the signed-in administrator. Used by every admin policy and admin function.
-- SECURITY DEFINER so it can read profiles although clients cannot; it only ever reveals a boolean about the caller.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- Run ONCE by the database owner after creating the administrator's Auth user in the Supabase dashboard
-- (see docs/supabase/security.md). Not callable through the API: it lives in `private` and has no client grants.
create function private.provision_administrator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'no auth user with that id' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles p where p.role = 'admin' and p.id <> p_user_id) then
    raise exception 'an administrator already exists' using errcode = '23505';
  end if;
  insert into public.profiles (id, role) values (p_user_id, 'admin') on conflict (id) do nothing;
end;
$$;
revoke all on function private.provision_administrator(uuid) from public, anon, authenticated;
grant execute on function private.provision_administrator(uuid) to service_role;
