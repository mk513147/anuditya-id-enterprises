-- School data file submissions and their review.
-- Forward-only. Builds on migrations 1-13; changes no earlier migration file.
--
-- What it adds:
--   1. Submission details on uploaded_files (school, contact person, contact details, category, description, optional
--      instructions) and a review state (pending / approved / rejected / corrections_required) with notes, time and reviewer.
--      Existing records keep working: their new submission columns stay null and they start as 'pending'.
--   2. uploaded_file_reviews: an append-only history of review decisions (administrator read only).
--   3. submit_school_file(): the ONE public way to register an uploaded spreadsheet. It takes only the submission fields,
--      re-checks the school and every value, verifies the stored object, and always stores 'pending'.
--      The older submit_file_upload() (no submission details) is withdrawn from anon/authenticated.
--   4. admin_review_file(): the administrator's decision + notes, re-checking is_admin() in the database.
--   5. admin_summary() gains file review counts and a count of unregistered uploads (for cleanup).
--
-- Least privilege: no new table/column grant for anon; authenticated may only SELECT the history table (RLS: administrator
-- only). uploaded_files stays read-only for every client role; the review goes through the SECURITY DEFINER function.

-- ------------------------------------------------------------------ 1. submission details and review state
create type public.file_category as enum ('student_data', 'design_materials', 'data_corrections', 'other');
create type public.file_review_status as enum ('pending', 'approved', 'rejected', 'corrections_required');

alter table public.uploaded_files
  add column contact_person text
    check (contact_person is null or (char_length(btrim(contact_person)) between 2 and 80 and contact_person !~ '[<>]')),
  -- An Indian mobile number (10 digits) or an email address, stored in a normalised form by submit_school_file().
  add column contact_details text
    check (contact_details is null or (char_length(contact_details) <= 120 and (
      contact_details ~ '^[6-9][0-9]{9}$' or contact_details ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$'))),
  add column category public.file_category,
  add column description text
    check (description is null or char_length(btrim(description)) between 20 and 1000),
  add column instructions text
    check (instructions is null or char_length(btrim(instructions)) between 1 and 1000),
  add column review_status public.file_review_status not null default 'pending',
  add column review_notes text
    check (review_notes is null or char_length(review_notes) between 1 and 1000),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  -- A submission either carries all required details (new records) or none (records made before this migration).
  add constraint uploaded_files_submission_complete check (
    (contact_person is null and contact_details is null and category is null and description is null and instructions is null)
    or (contact_person is not null and contact_details is not null and category is not null and description is not null)
  ),
  add constraint uploaded_files_review_consistent check ((review_status = 'pending') = (reviewed_at is null));

create index uploaded_files_review_idx on public.uploaded_files (review_status, uploaded_at desc);

-- ------------------------------------------------------------------ 2. review history (append-only, administrator read)
create table public.uploaded_file_reviews (
  id bigint generated always as identity primary key,
  file_id uuid not null references public.uploaded_files (id) on delete restrict,
  review_status public.file_review_status not null,
  review_notes text check (review_notes is null or char_length(review_notes) between 1 and 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz not null default now()
);
create index uploaded_file_reviews_file_idx on public.uploaded_file_reviews (file_id, reviewed_at);
alter table public.uploaded_file_reviews enable row level security;
revoke all on table public.uploaded_file_reviews from anon, authenticated;
grant select on public.uploaded_file_reviews to authenticated;
create policy uploaded_file_reviews_admin_select on public.uploaded_file_reviews for select to authenticated using (private.is_admin());

-- ------------------------------------------------------------------ 3. public submission
-- Contact details: a 10-digit Indian mobile (spaces, hyphens and a +91 / 0 prefix are removed) or an email (lower-cased).
create function private.normalize_contact(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
  v_digits text := regexp_replace(v, '[\s()-]', '', 'g');
begin
  v_digits := regexp_replace(v_digits, '^(\+91|0091|0)', '');
  if v_digits ~ '^[6-9][0-9]{9}$' then
    return v_digits;
  end if;
  if char_length(v) <= 120 and v ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$' then
    return lower(v);
  end if;
  return null;
end;
$$;
revoke all on function private.normalize_contact(text) from public;

create function public.submit_school_file(
  p_school_id uuid,
  p_contact_person text,
  p_contact_details text,
  p_category public.file_category,
  p_description text,
  p_storage_path text,
  p_original_name text,
  p_instructions text default null
)
returns table (reference_no text, original_name text, file_type public.file_type, size_bytes bigint, uploaded_at timestamptz, school_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_school text;
  v_active boolean;
  v_person text := btrim(coalesce(p_contact_person, ''));
  v_contact text := private.normalize_contact(p_contact_details);
  v_description text := btrim(coalesce(p_description, ''));
  v_instructions text := nullif(btrim(coalesce(p_instructions, '')), '');
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_name text := btrim(coalesce(p_original_name, ''));
  v_meta jsonb;
  v_ext text;
  v_size bigint;
begin
  -- The school is re-checked here; nothing from the browser is trusted.
  select s.name, s.is_active into v_school, v_active from public.schools s where s.id = p_school_id;
  if v_school is null or not v_active then
    raise exception 'school_unavailable' using errcode = 'P0001';
  end if;

  if char_length(v_person) not between 2 and 80 or v_person ~ '[<>]' then
    raise exception 'invalid_input' using errcode = '22023', detail = 'contact_person';
  end if;
  if v_contact is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'contact_details';
  end if;
  if p_category is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'category';
  end if;
  if char_length(v_description) not between 20 and 1000 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'description';
  end if;
  if v_instructions is not null and char_length(v_instructions) > 1000 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'instructions';
  end if;

  -- The stored object: fixed folder, random name, allowed extension matching the original name, really uploaded, and
  -- with the size and type Storage recorded (fail closed when they are missing).
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
  v_size := nullif(coalesce(v_meta ->> 'size', v_meta ->> 'contentLength'), '')::bigint;
  if v_size is null or v_meta ->> 'mimetype' is null then
    raise exception 'file_not_uploaded' using errcode = 'P0001', detail = 'storage metadata missing';
  end if;
  if v_meta ->> 'mimetype' not in (
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'application/csv'
     ) then
    raise exception 'invalid_file' using errcode = '22023', detail = 'stored type not allowed';
  end if;

  -- CHECK constraints enforce the 10 MB limit, a non-empty file and a safe file name; the unique index refuses registering
  -- the same object twice. The review state is always 'pending' here: no parameter can set it.
  return query
    insert into public.uploaded_files as f (
      original_name, file_type, size_bytes, storage_bucket, storage_path, storage_state, school_id,
      contact_person, contact_details, category, description, instructions, review_status
    ) values (
      v_name, v_ext::public.file_type, v_size, 'school-uploads', v_path, 'stored', p_school_id,
      v_person, v_contact, p_category, v_description, v_instructions, 'pending'
    )
    returning f.reference_no, f.original_name, f.file_type, f.size_bytes, f.uploaded_at, v_school;
end;
$$;
revoke all on function public.submit_school_file(uuid, text, text, public.file_category, text, text, text, text) from public;
grant execute on function public.submit_school_file(uuid, text, text, public.file_category, text, text, text, text) to anon, authenticated;

-- The older registration (migration 13) records an upload with no school or contact details. The public form now always
-- sends them, so the older entry point is withdrawn from client roles (one public path, one set of checks).
revoke execute on function public.submit_file_upload(text, text) from anon, authenticated;

-- ------------------------------------------------------------------ 4. administrator review
-- Sets the decision and REPLACES the notes (null/blank clears them). Returning to 'pending' clears the review time.
create function public.admin_review_file(p_file_id uuid, p_status public.file_review_status, p_notes text default null)
returns table (file_id uuid, review_status public.file_review_status, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current public.file_review_status;
  v_current_notes text;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'status';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'notes';
  end if;
  select f.review_status, f.review_notes into v_current, v_current_notes from public.uploaded_files f where f.id = p_file_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current = p_status and v_current_notes is not distinct from v_notes then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  v_at := case when p_status = 'pending' then null else now() end;
  update public.uploaded_files f
     set review_status = p_status,
         review_notes = v_notes,
         reviewed_at = v_at,
         reviewed_by = case when p_status = 'pending' then null else auth.uid() end
   where f.id = p_file_id;
  insert into public.uploaded_file_reviews (file_id, review_status, review_notes, reviewed_by)
  values (p_file_id, p_status, v_notes, auth.uid());
  return query select p_file_id, p_status, v_at;
end;
$$;
revoke all on function public.admin_review_file(uuid, public.file_review_status, text) from public;
grant execute on function public.admin_review_file(uuid, public.file_review_status, text) to authenticated;

-- ------------------------------------------------------------------ 5. administrator summary: file review counts
-- Same output as migration 13, plus files.byReview / files.pendingReview and storage.unregisteredUploads (objects in the
-- public upload folders older than one hour that no record uses; anonymous visitors cannot delete them, see the docs).
create or replace function public.admin_summary()
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
        'byType', jsonb_build_object('xlsx', count(*) filter (where f.file_type = 'xlsx'), 'xls', count(*) filter (where f.file_type = 'xls'), 'csv', count(*) filter (where f.file_type = 'csv')),
        'pendingReview', count(*) filter (where f.review_status = 'pending'),
        'byReview', jsonb_build_object(
          'pending', count(*) filter (where f.review_status = 'pending'),
          'approved', count(*) filter (where f.review_status = 'approved'),
          'rejected', count(*) filter (where f.review_status = 'rejected'),
          'corrections_required', count(*) filter (where f.review_status = 'corrections_required'))
      ) from public.uploaded_files f),
    'storage', jsonb_build_object(
      'unregisteredUploads', (select count(*) from storage.objects o
        where o.created_at < now() - interval '1 hour'
          and ((o.bucket_id = 'school-uploads' and o.name like 'incoming/%'
                and not exists (select 1 from public.uploaded_files f where f.storage_bucket = o.bucket_id and f.storage_path = o.name))
            or (o.bucket_id = 'student-photos' and o.name like 'submissions/%'
                and not exists (select 1 from public.students st where st.photo_path = o.name))))
    ),
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
        select s.id, s.name, s.code, s.is_active, s.created_at,
               (select count(*) from public.students st where st.school_id = s.id and st.archived_at is null) as student_count
        from public.schools s order by s.created_at desc limit 4
      ) x)
  ) into v;
  return v;
end;
$$;
-- CREATE OR REPLACE keeps the existing grants (authenticated only; revoked from PUBLIC in migration 13).
