-- Public school-image submissions, sharing the SAME bucket (`school-images`), table (`school_images`) and duplicate rule
-- (unique school_id + content_sha256) as the administrator's uploads. Forward-only; changes no earlier migration file.
--
-- Design:
--   * School images gain a review state. Every existing image, and every image the administrator uploads, is 'approved'
--     (exactly as before). Public submissions are stored 'pending', never primary, until the administrator approves them.
--     Only an approved image can be primary.
--   * Public uploads go to submissions/<school id>/<sha256>.<ext>. The object name IS the content checksum, so a retry, a
--     double click or two people sending the same image all land on the same object: with a non-overwriting upload a
--     second copy can never be created, and registering it again is a no-op.
--   * Anonymous visitors get INSERT only into that folder (no read, list, update or delete), a duplicate pre-check
--     (school_image_already_present) and submit_school_image(). The administrator functions stay administrator-only.
--   * Admin-only additions: admin_review_school_image(); admin_set_primary_school_image() now refuses unapproved images.

-- ------------------------------------------------------------------ 1. review state and submission details
create type public.school_image_status as enum ('pending', 'approved', 'rejected');

alter table public.school_images
  add column review_status public.school_image_status not null default 'approved',
  add column source text not null default 'admin' check (source in ('admin', 'public')),
  add column submitted_contact_person text
    check (submitted_contact_person is null or (char_length(btrim(submitted_contact_person)) between 2 and 80 and submitted_contact_person !~ '[<>]')),
  add column submitted_contact_details text
    check (submitted_contact_details is null or (char_length(submitted_contact_details) <= 120 and (
      submitted_contact_details ~ '^[6-9][0-9]{9}$' or submitted_contact_details ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$'))),
  add column submission_note text check (submission_note is null or char_length(btrim(submission_note)) between 1 and 500),
  add column reviewed_at timestamptz;

-- Paths: administrator uploads keep schools/<school>/<uuid>.<ext>; public submissions use submissions/<school>/<sha256>.<ext>.
alter table public.school_images drop constraint school_images_storage_path_check;
alter table public.school_images add constraint school_images_storage_path_check check (
  storage_path ~ '^schools/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  or storage_path ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.(jpg|png|webp)$'
);
alter table public.school_images drop constraint school_images_path_matches_school;
alter table public.school_images add constraint school_images_path_matches_school check (
  storage_path like 'schools/' || school_id::text || '/%' or storage_path like 'submissions/' || school_id::text || '/%'
);
alter table public.school_images
  add constraint school_images_source_consistent check (
    (source = 'admin' and storage_path like 'schools/%' and submitted_contact_person is null and submitted_contact_details is null and submission_note is null)
    or (source = 'public' and storage_path like 'submissions/%' and submitted_contact_person is not null and submitted_contact_details is not null)
  ),
  add constraint school_images_primary_is_approved check (not is_primary or review_status = 'approved'),
  add constraint school_images_public_review_time check (source = 'admin' or (review_status = 'pending') = (reviewed_at is null));

create index school_images_pending_idx on public.school_images (school_id) where review_status = 'pending';

-- ------------------------------------------------------------------ 2. public upload: insert-only, content-named
create policy "public can submit a school image" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'school-images'
    and name ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.(jpg|png|webp)$'
  );

-- ------------------------------------------------------------------ 3. public duplicate pre-check
-- Lets the browser skip uploading an image the school already has (admin-uploaded or submitted). It can only confirm an
-- image the caller already holds byte for byte (they must supply its SHA-256), and reveals nothing else.
create function public.school_image_already_present(p_school_id uuid, p_sha256 text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_images i
    where i.school_id = p_school_id and i.content_sha256 = lower(btrim(coalesce(p_sha256, ''))) and lower(btrim(coalesce(p_sha256, ''))) ~ '^[0-9a-f]{64}$'
  )
$$;
revoke all on function public.school_image_already_present(uuid, text) from public;
grant execute on function public.school_image_already_present(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------------ 4. public submission
-- Accepts only the submission fields. Always 'pending', never primary. Idempotent: the same image for the same school
-- (whoever added it) returns 'already_present' and creates nothing.
create function public.submit_school_image(
  p_school_id uuid,
  p_contact_person text,
  p_contact_details text,
  p_storage_path text,
  p_original_name text,
  p_sha256 text,
  p_note text default null
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_active boolean;
  v_person text := btrim(coalesce(p_contact_person, ''));
  v_contact text := private.normalize_contact(p_contact_details);
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_name text := btrim(coalesce(p_original_name, ''));
  v_sha text := lower(btrim(coalesce(p_sha256, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_meta jsonb;
  v_mime text;
  v_size bigint;
  v_ext text;
  v_order integer;
begin
  -- The school is re-checked here and its row locked, so concurrent submissions for one school are serialised.
  select s.is_active into v_active from public.schools s where s.id = p_school_id for update;
  if v_active is null or not v_active then
    raise exception 'school_unavailable' using errcode = 'P0001';
  end if;
  if char_length(v_person) not between 2 and 80 or v_person ~ '[<>]' then
    raise exception 'invalid_input' using errcode = '22023', detail = 'contact_person';
  end if;
  if v_contact is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'contact_details';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'note';
  end if;
  if v_sha !~ '^[0-9a-f]{64}$' or char_length(v_name) not between 1 and 255 or v_name ~ '[/\\<>]' then
    raise exception 'invalid_image' using errcode = '22023', detail = 'name or checksum';
  end if;
  -- The object must be the content-named one for THIS school and THIS checksum.
  if v_path !~ ('^submissions/' || p_school_id::text || '/' || v_sha || '\.(jpg|png|webp)$') then
    raise exception 'invalid_image' using errcode = '22023', detail = 'unexpected storage path';
  end if;

  if exists (select 1 from public.school_images i where i.school_id = p_school_id and i.content_sha256 = v_sha) then
    return query select 'already_present'::text;
    return;
  end if;

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

  select coalesce(max(i.display_order) + 1, 0) into v_order from public.school_images i where i.school_id = p_school_id;
  insert into public.school_images (
    school_id, storage_path, original_name, mime_type, size_bytes, content_sha256, is_primary, display_order,
    review_status, source, submitted_contact_person, submitted_contact_details, submission_note
  ) values (
    p_school_id, v_path, v_name, v_mime, v_size, v_sha, false, v_order,
    'pending', 'public', v_person, v_contact, v_note
  );
  return query select 'submitted'::text;
end;
$$;
revoke all on function public.submit_school_image(uuid, text, text, text, text, text, text) from public;
grant execute on function public.submit_school_image(uuid, text, text, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------------ 5. administrator review
create function public.admin_review_school_image(p_image_id uuid, p_decision public.school_image_status)
returns table (image_id uuid, review_status public.school_image_status)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current public.school_image_status;
  v_primary boolean;
  v_source text;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'decision';
  end if;
  select i.review_status, i.is_primary, i.source into v_current, v_primary, v_source from public.school_images i where i.id = p_image_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current = p_decision then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  if v_primary then
    -- The primary image is always approved: choose another primary image first.
    raise exception 'primary_image' using errcode = 'P0001';
  end if;
  if v_source = 'admin' and p_decision = 'pending' then
    raise exception 'invalid_input' using errcode = '22023', detail = 'administrator uploads are not sent for review';
  end if;
  update public.school_images i
     set review_status = p_decision,
         reviewed_at = case when p_decision = 'pending' then null else now() end
   where i.id = p_image_id;
  return query select p_image_id, p_decision;
end;
$$;
revoke all on function public.admin_review_school_image(uuid, public.school_image_status) from public;
grant execute on function public.admin_review_school_image(uuid, public.school_image_status) to authenticated;

-- Only an approved image can become primary (same signature and grants as migration 15).
create or replace function public.admin_set_primary_school_image(p_image_id uuid)
returns table (image_id uuid, school_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school uuid;
  v_primary boolean;
  v_status public.school_image_status;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select i.school_id, i.is_primary, i.review_status into v_school, v_primary, v_status from public.school_images i where i.id = p_image_id;
  if v_school is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'not_approved' using errcode = 'P0001';
  end if;
  if v_primary then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  perform 1 from public.schools s where s.id = v_school for update;
  update public.school_images i set is_primary = false where i.school_id = v_school and i.is_primary;
  update public.school_images i set is_primary = true where i.id = p_image_id;
  return query select p_image_id, v_school;
end;
$$;
