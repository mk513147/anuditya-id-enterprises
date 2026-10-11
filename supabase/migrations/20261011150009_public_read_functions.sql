-- Phase A / 9 of 11: narrowly scoped PUBLIC read operations.
--
-- Each function is SECURITY DEFINER (the table has no anonymous access), has a fixed empty search_path, returns an
-- explicit column list, and is granted to anon/authenticated one by one. Hidden rows (disabled services, drafts,
-- pending feedback, inactive schools) never leave the database.

-- Active schools for the public student form dropdown. id + name ONLY: no contact person, phone, email or address.
create function public.list_active_schools()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name
  from public.schools s
  where s.is_active
  order by s.name
$$;

-- Resolves /school/:slug. One row always. An inactive or unknown school reveals nothing but its status.
create function public.resolve_school(p_slug text)
returns table (status text, school_id uuid, name text, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  with hit as (
    select s.id, s.name, s.slug, s.is_active
    from public.schools s
    where lower(s.slug) = lower(btrim(p_slug))
    limit 1
  )
  select
    case when h.id is null then 'not_found' when h.is_active then 'active' else 'inactive' end,
    case when h.is_active then h.id end,
    case when h.is_active then h.name end,
    case when h.is_active then h.slug end
  from (select 1) one
  left join hit h on true
$$;

-- Enabled services in display order (Home, /services and the quote form). Disabled services are never returned.
create function public.list_enabled_services()
returns table (
  id uuid, slug text, title text, tagline text, category public.service_category,
  description text, image_url text, icon text, display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.title, s.tagline, s.category, s.description, s.image_url, s.icon, s.display_order
  from public.services s
  where s.enabled
  order by s.display_order, s.title
$$;

-- Advertisements the public may see right now: enabled AND published AND started AND not ended.
-- The clock is the database's, never a client-supplied time. Rows keep creation order (as the mock does).
create function public.list_published_advertisements()
returns table (
  id uuid, title text, description text, offer text, image_url text, icon text,
  whatsapp_message text, featured boolean, starts_at timestamptz, ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.description, a.offer, a.image_url, a.icon, a.whatsapp_message, a.featured, a.starts_at, a.ends_at
  from public.advertisements a
  where a.active
    and a.is_published
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at >= now())
  order by a.created_at, a.id
$$;

-- Approved feedback only, newest first. The mock returns all approved items; the cap (default 100, max 100) is
-- a safety limit so the list can never become unbounded.
create function public.list_approved_feedback(p_limit integer default 100)
returns table (id uuid, name text, organization text, rating smallint, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.name, f.organization, f.rating, f.message, f.created_at
  from public.feedback f
  where f.status = 'approved'
  order by f.created_at desc, f.id
  limit greatest(1, least(coalesce(p_limit, 100), 100))
$$;

revoke all on function public.list_active_schools() from public;
revoke all on function public.resolve_school(text) from public;
revoke all on function public.list_enabled_services() from public;
revoke all on function public.list_published_advertisements() from public;
revoke all on function public.list_approved_feedback(integer) from public;

grant execute on function public.list_active_schools() to anon, authenticated;
grant execute on function public.resolve_school(text) to anon, authenticated;
grant execute on function public.list_enabled_services() to anon, authenticated;
grant execute on function public.list_published_advertisements() to anon, authenticated;
grant execute on function public.list_approved_feedback(integer) to anon, authenticated;
