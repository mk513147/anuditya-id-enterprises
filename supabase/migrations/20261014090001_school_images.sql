-- School images: several images per school, uploaded in bulk by the administrator.
-- Forward-only. Builds on migrations 1-14 and changes none of them.
--
--   * Bucket `school-images`: PRIVATE, JPEG / PNG / WebP up to 5 MB. Images are shown to the administrator through
--     short-lived signed URLs; no public page displays them (there is no public school-image delivery to preserve).
--   * Only the administrator may upload, into schools/<school id>/<random uuid>.<ext>; anonymous visitors have no access.
--   * The administrator may delete an object ONLY while no record uses it (cleanup after a failed registration).
--     Registered images cannot be deleted from the client, and the existing buckets keep their no-delete rule.
--   * `school_images` is read-only for client roles; rows are created by admin_register_school_image(), which checks the
--     stored object itself (bucket, path, type and size recorded by Storage) before registering it.

-- ------------------------------------------------------------------ 1. bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-images', 'school-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------------ 2. image records
create table public.school_images (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  storage_bucket text not null default 'school-images' check (storage_bucket = 'school-images'),
  storage_path text not null unique
    check (storage_path ~ '^schools/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  original_name text not null check (char_length(original_name) between 1 and 255 and original_name !~ '[/\\<>]'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  -- Computed in the browser before upload; stops the same image being registered twice for one school.
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  alt_text text check (alt_text is null or (char_length(btrim(alt_text)) between 1 and 200 and alt_text !~ '[<>]')),
  is_primary boolean not null default false,
  display_order integer not null check (display_order >= 0),
  created_at timestamptz not null default now(),
  constraint school_images_path_matches_school check (storage_path like 'schools/' || school_id::text || '/%'),
  constraint school_images_unique_content unique (school_id, content_sha256)
);
create unique index school_images_one_primary on public.school_images (school_id) where is_primary;
create index school_images_school_idx on public.school_images (school_id, display_order);

alter table public.school_images enable row level security;
revoke all on table public.school_images from anon, authenticated;
grant select on public.school_images to authenticated;
create policy school_images_admin_select on public.school_images for select to authenticated using (private.is_admin());

-- ------------------------------------------------------------------ 3. storage policies (school-images only)
create policy "administrator can upload school images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'school-images'
    and private.is_admin()
    and name ~ '^schools/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create policy "administrator can read school images" on storage.objects
  for select to authenticated
  using (bucket_id = 'school-images' and private.is_admin());

create policy "administrator can remove unregistered school images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'school-images'
    and private.is_admin()
    and not exists (select 1 from public.school_images i where i.storage_bucket = 'school-images' and i.storage_path = name)
  );

-- ------------------------------------------------------------------ 4. register an uploaded image
create function public.admin_register_school_image(
  p_school_id uuid,
  p_storage_path text,
  p_original_name text,
  p_sha256 text,
  p_alt_text text default null
)
returns table (image_id uuid, is_primary boolean, display_order integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_name text := btrim(coalesce(p_original_name, ''));
  v_sha text := lower(btrim(coalesce(p_sha256, '')));
  v_alt text := nullif(btrim(coalesce(p_alt_text, '')), '');
  v_meta jsonb;
  v_mime text;
  v_size bigint;
  v_ext text;
  v_id uuid := gen_random_uuid();
  v_primary boolean;
  v_order integer;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- Serialise registrations for one school (display order and the first-image-is-primary rule).
  perform 1 from public.schools s where s.id = p_school_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002', detail = 'school';
  end if;
  if v_path !~ ('^schools/' || p_school_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then
    raise exception 'invalid_image' using errcode = '22023', detail = 'unexpected storage path';
  end if;
  if v_sha !~ '^[0-9a-f]{64}$' or char_length(v_name) not between 1 and 255 or v_name ~ '[/\\<>]' then
    raise exception 'invalid_image' using errcode = '22023', detail = 'name or checksum';
  end if;
  if v_alt is not null and (char_length(v_alt) > 200 or v_alt ~ '[<>]') then
    raise exception 'invalid_image' using errcode = '22023', detail = 'alt text';
  end if;
  if exists (select 1 from public.school_images i where i.school_id = p_school_id and i.content_sha256 = v_sha) then
    raise exception 'duplicate_image' using errcode = 'P0001';
  end if;

  -- The object Storage actually holds: it must exist, with a recorded type and size that are allowed (fail closed).
  select o.metadata into v_meta from storage.objects o where o.bucket_id = 'school-images' and o.name = v_path;
  if not found then
    raise exception 'image_not_uploaded' using errcode = 'P0001';
  end if;
  v_mime := v_meta ->> 'mimetype';
  v_size := nullif(coalesce(v_meta ->> 'size', v_meta ->> 'contentLength'), '')::bigint;
  if v_mime is null or v_size is null then
    raise exception 'image_not_uploaded' using errcode = 'P0001', detail = 'storage metadata missing';
  end if;
  v_ext := substring(v_path from '\.([a-z]+)$');
  if not ((v_mime = 'image/jpeg' and v_ext = 'jpg') or (v_mime = 'image/png' and v_ext = 'png') or (v_mime = 'image/webp' and v_ext = 'webp'))
     or v_size not between 1 and 5242880 then
    raise exception 'invalid_image' using errcode = '22023', detail = 'stored type or size not allowed';
  end if;

  v_primary := not exists (select 1 from public.school_images i where i.school_id = p_school_id and i.is_primary);
  select coalesce(max(i.display_order) + 1, 0) into v_order from public.school_images i where i.school_id = p_school_id;
  insert into public.school_images (id, school_id, storage_path, original_name, mime_type, size_bytes, content_sha256, alt_text, is_primary, display_order)
  values (v_id, p_school_id, v_path, v_name, v_mime, v_size, v_sha, v_alt, v_primary, v_order);
  return query select v_id, v_primary, v_order;
end;
$$;
revoke all on function public.admin_register_school_image(uuid, text, text, text, text) from public;
grant execute on function public.admin_register_school_image(uuid, text, text, text, text) to authenticated;

-- ------------------------------------------------------------------ 5. choose the primary image
create function public.admin_set_primary_school_image(p_image_id uuid)
returns table (image_id uuid, school_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid;
  v_primary boolean;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select i.school_id, i.is_primary into v_school, v_primary from public.school_images i where i.id = p_image_id;
  if v_school is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_primary then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  perform 1 from public.schools s where s.id = v_school for update;
  -- Two statements: the one-primary unique index is checked row by row.
  update public.school_images i set is_primary = false where i.school_id = v_school and i.is_primary;
  update public.school_images i set is_primary = true where i.id = p_image_id;
  return query select p_image_id, v_school;
end;
$$;
revoke all on function public.admin_set_primary_school_image(uuid) from public;
grant execute on function public.admin_set_primary_school_image(uuid) to authenticated;
