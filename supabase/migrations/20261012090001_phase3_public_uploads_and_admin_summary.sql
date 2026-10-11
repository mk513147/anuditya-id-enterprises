-- Phase 3 / 1: public uploads into the PRIVATE buckets, registering those uploads, and one administrator summary.
-- Forward-only. Does not change any earlier migration, policy or grant; it only adds.
--
-- Why it is needed (the Phase A design left these to "trusted server code"):
--   * the public student form must attach a photo, and the public file-upload page must store a spreadsheet, but no client
--     role could write to either bucket and nothing could register an uploaded spreadsheet;
--   * the admin dashboard and list pages need overall counts, which would otherwise take many separate requests.
--
-- Least privilege:
--   * anon/authenticated may only INSERT, only into a fixed folder, only with a random-UUID file name and an allowed
--     extension. Bucket size and MIME limits still apply. There is still no client SELECT/UPDATE/DELETE on either bucket
--     (so nothing can be listed, read, overwritten or removed); only the administrator can read objects (migration 11).
--   * registering an upload (student photo, spreadsheet) happens only through SECURITY DEFINER functions that check the
--     object really exists, has the expected path, type and size, and is not already used by another record.
-- Known residual risk: an anonymous visitor can upload objects that are never registered (storage spam within the bucket
-- limits). Rate limiting / bot protection belongs in front of the API (see docs/supabase/security.md).

-- ------------------------------------------------------------------ 1. insert-only upload policies
create policy "public can upload a submission photo" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'student-photos'
    and name ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$'
  );

create policy "public can upload a spreadsheet" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'school-uploads'
    and name ~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(xlsx|xls|csv)$'
  );

-- ------------------------------------------------------------------ 2. an object can back at most one record
-- Before this migration submit_student accepted any well-formed photo path, so check for duplicates first and stop with a
-- clear message (the whole migration rolls back; nothing is changed) instead of an opaque index-build failure.
do $$
begin
  if exists (select 1 from public.students where photo_path is not null group by photo_path having count(*) > 1) then
    raise exception 'Migration 20261012090001 stopped: some students share a photo_path. Resolve the duplicates (set the extra ones to null) and re-run.';
  end if;
end
$$;
create unique index students_photo_path_key on public.students (photo_path) where photo_path is not null;
create unique index uploaded_files_storage_object_key on public.uploaded_files (storage_bucket, storage_path) where storage_path is not null;

-- ------------------------------------------------------------------ 3. student submission: validate the photo when one is given
-- Same signature, grants and behaviour as before (migration 10); the only change is that a supplied photo path must be a
-- real, freshly uploaded object in the private bucket that no other student uses. A submission is still always 'pending'.
create or replace function public.submit_student(
  p_school_id uuid,
  p_name text,
  p_father_name text,
  p_mother_name text,
  p_dob date,
  p_class_name text,
  p_section text,
  p_roll_no text,
  p_admission_no text,
  p_address text,
  p_mobile text,
  p_blood_group text default null,
  p_house_name text default null,
  p_house_colour text default null,
  p_bus_route text default null,
  p_bus_stoppage text default null,
  p_photo_path text default null
)
returns table (reference_no text, submitted_at timestamptz, school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_name text;
  v_active boolean;
  v_photo text := nullif(btrim(p_photo_path), '');
  v_meta jsonb;
  v_ref text;
  v_at timestamptz;
begin
  select s.name, s.is_active into v_school_name, v_active from public.schools s where s.id = p_school_id;
  if v_school_name is null or not v_active then
    raise exception 'school_unavailable' using errcode = 'P0001';
  end if;

  if v_photo is not null then
    if v_photo !~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$' then
      raise exception 'invalid_photo' using errcode = '22023', detail = 'unexpected photo path';
    end if;
    select o.metadata into v_meta from storage.objects o where o.bucket_id = 'student-photos' and o.name = v_photo;
    if not found then
      raise exception 'photo_not_uploaded' using errcode = 'P0001';
    end if;
    -- Fail closed: the type and size Storage recorded for the object must be present AND allowed (the browser's claims are
    -- never trusted). An object whose metadata is not (yet) recorded is treated as not uploaded.
    if v_meta is null or v_meta ->> 'mimetype' is null or coalesce(v_meta ->> 'size', v_meta ->> 'contentLength') is null then
      raise exception 'photo_not_uploaded' using errcode = 'P0001', detail = 'storage metadata missing';
    end if;
    if v_meta ->> 'mimetype' not in ('image/jpeg', 'image/png')
       or coalesce(v_meta ->> 'size', v_meta ->> 'contentLength')::bigint not between 1 and 2097152 then
      raise exception 'invalid_photo' using errcode = '22023', detail = 'photo type or size not allowed';
    end if;
    if exists (select 1 from public.students st where st.photo_path = v_photo) then
      raise exception 'invalid_photo' using errcode = '22023', detail = 'photo already used';
    end if;
  end if;

  insert into public.students (
    school_id, name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile,
    blood_group, house_name, house_colour, bus_route, bus_stoppage, photo_path, approval_status, reviewed_at
  ) values (
    p_school_id, btrim(p_name), btrim(p_father_name), btrim(p_mother_name), p_dob, btrim(p_class_name), upper(btrim(p_section)),
    btrim(p_roll_no), btrim(p_admission_no), btrim(p_address), btrim(p_mobile),
    nullif(btrim(p_blood_group), ''), nullif(btrim(p_house_name), ''), nullif(btrim(p_house_colour), ''),
    nullif(btrim(p_bus_route), ''), nullif(btrim(p_bus_stoppage), ''), v_photo,
    'pending', null
  )
  returning students.reference_no, students.submitted_at into v_ref, v_at;

  return query select v_ref, v_at, v_school_name;
end;
$$;
-- CREATE OR REPLACE keeps the existing grants (anon, authenticated) and the revoke from PUBLIC.

-- ------------------------------------------------------------------ 4. register an uploaded spreadsheet
create function public.submit_file_upload(p_storage_path text, p_original_name text)
returns table (reference_no text, original_name text, file_type public.file_type, size_bytes bigint, uploaded_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_name text := btrim(coalesce(p_original_name, ''));
  v_meta jsonb;
  v_ext text;
  v_size bigint;
begin
  if v_path !~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(xlsx|xls|csv)$' then
    raise exception 'invalid_file' using errcode = '22023', detail = 'unexpected storage path';
  end if;
  v_ext := substring(v_path from '\.([a-z]+)$');
  if lower(v_name) !~ ('\.' || v_ext || '$') then
    raise exception 'invalid_file' using errcode = '22023', detail = 'file name and stored type differ';
  end if;
  select o.metadata into v_meta from storage.objects o where o.bucket_id = 'school-uploads' and o.name = v_path;
  if not found then
    raise exception 'file_not_uploaded' using errcode = 'P0001';
  end if;
  -- Fail closed on the metadata Storage recorded: size present, type one the bucket allows.
  v_size := nullif(coalesce(v_meta ->> 'size', v_meta ->> 'contentLength'), '')::bigint;
  if v_size is null or v_meta ->> 'mimetype' is null then
    raise exception 'file_not_uploaded' using errcode = 'P0001', detail = 'storage metadata missing';
  end if;
  if v_meta ->> 'mimetype' not in (
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'application/csv'
     ) then
    raise exception 'invalid_file' using errcode = '22023', detail = 'stored type not allowed';
  end if;
  -- CHECK constraints on uploaded_files enforce the 10 MB limit, a non-empty file and a safe file name;
  -- the unique index refuses registering the same object twice.
  return query
    insert into public.uploaded_files as f (original_name, file_type, size_bytes, storage_bucket, storage_path, storage_state)
    values (v_name, v_ext::public.file_type, v_size, 'school-uploads', v_path, 'stored')
    returning f.reference_no, f.original_name, f.file_type, f.size_bytes, f.uploaded_at;
end;
$$;
revoke all on function public.submit_file_upload(text, text) from public;
grant execute on function public.submit_file_upload(text, text) to anon, authenticated;

-- ------------------------------------------------------------------ 5. administrator summary (counts only)
-- One request for the dashboard and the list-page totals. Aggregates only; refuses anyone but the administrator.
create function public.admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'schools', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where s.is_active)) from public.schools s),
    'students', (select jsonb_build_object(
        'total', count(*),
        'notArchived', count(*) filter (where st.archived_at is null),
        'archived', count(*) filter (where st.archived_at is not null),
        'pending', count(*) filter (where st.approval_status = 'pending' and st.archived_at is null),
        'approved', count(*) filter (where st.approval_status = 'approved' and st.archived_at is null),
        'rejected', count(*) filter (where st.approval_status = 'rejected' and st.archived_at is null)
      ) from public.students st),
    'studentSections', (select coalesce(jsonb_agg(distinct upper(st.section) order by upper(st.section)), '[]'::jsonb) from public.students st),
    'orders', jsonb_build_object(
      'total', (select count(*) from public.orders),
      'byStatus', (select jsonb_object_agg(e.status::text, (select count(*) from public.orders o where o.status = e.status))
                   from unnest(enum_range(null::public.order_status)) as e(status))
    ),
    'files', (select jsonb_build_object(
        'total', count(*),
        'totalBytes', coalesce(sum(f.size_bytes), 0),
        'stored', count(*) filter (where f.storage_state = 'stored'),
        'byType', jsonb_build_object('xlsx', count(*) filter (where f.file_type = 'xlsx'), 'xls', count(*) filter (where f.file_type = 'xls'), 'csv', count(*) filter (where f.file_type = 'csv'))
      ) from public.uploaded_files f),
    'services', (select jsonb_build_object(
        'total', count(*), 'enabled', count(*) filter (where sv.enabled), 'disabled', count(*) filter (where not sv.enabled),
        'byCategory', jsonb_build_object(
          'id-cards', count(*) filter (where sv.category = 'id-cards'),
          'school-materials', count(*) filter (where sv.category = 'school-materials'),
          'design-printing', count(*) filter (where sv.category = 'design-printing'))
      ) from public.services sv),
    'advertisements', (select jsonb_build_object(
        'total', count(*),
        'live', count(*) filter (where a.active and a.is_published and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at >= now())),
        'scheduled', count(*) filter (where a.active and a.is_published and a.starts_at > now()),
        'ended', count(*) filter (where a.active and a.is_published and (a.starts_at is null or a.starts_at <= now()) and a.ends_at < now()),
        'hidden', count(*) filter (where not a.active or not a.is_published),
        'drafts', count(*) filter (where not a.is_published),
        'disabled', count(*) filter (where not a.active)
      ) from public.advertisements a),
    'feedback', (select jsonb_build_object(
        'total', count(*), 'pending', count(*) filter (where fb.status = 'pending'),
        'approved', count(*) filter (where fb.status = 'approved'), 'rejected', count(*) filter (where fb.status = 'rejected')
      ) from public.feedback fb),
    'recentSchools', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        -- Only what the dashboard card shows (no contact details).
        select s.id, s.name, s.code, s.is_active, s.created_at,
               (select count(*) from public.students st where st.school_id = s.id and st.archived_at is null) as student_count
        from public.schools s order by s.created_at desc limit 4
      ) x)
  ) into v;
  return v;
end;
$$;
revoke all on function public.admin_summary() from public;
grant execute on function public.admin_summary() to authenticated;
