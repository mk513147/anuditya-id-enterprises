-- Spreadsheets and photos live in PRIVATE buckets: no anonymous read or download, administrator-only access, and file
-- records never imply that contents exist. (service_role stands for the trusted server code of Phase B.)
begin;
select plan(38);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone) values
  ('d0000000-0000-0000-0000-000000000001', 'File School', 'file-school', 'FIL-001', 'Test Person', '9000000001');

-- Bucket configuration -------------------------------------------------------------------------------------------------------------------
select is((select public from storage.buckets where id = 'school-uploads'), false, 'the spreadsheet bucket is private');
select is((select public from storage.buckets where id = 'student-photos'), false, 'the photo bucket is private');
select is((select file_size_limit from storage.buckets where id = 'school-uploads'), 10485760::bigint, 'spreadsheets are limited to 10 MB');
select is((select file_size_limit from storage.buckets where id = 'student-photos'), 2097152::bigint, 'photos are limited to 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'student-photos'), array['image/jpeg', 'image/png'], 'photos accept only JPEG and PNG');
select is((select 'text/csv' = any (allowed_mime_types) and 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = any (allowed_mime_types)
                  and not ('application/pdf' = any (allowed_mime_types)) from storage.buckets where id = 'school-uploads'), true, 'the spreadsheet bucket accepts spreadsheets only');
select is((select array_agg(cmd order by cmd) from pg_policies where schemaname = 'storage' and tablename = 'objects' and ('anon' = any (roles) or 'public' = any (roles))),
  array['INSERT', 'INSERT'],
  'anon has only the two insert-only upload policies (Phase 3): no anon SELECT, UPDATE or DELETE on storage');
select is((select array_agg(cmd order by cmd) from pg_policies where schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) not like '%school-images%'), array['INSERT', 'INSERT', 'SELECT'],
  'for the student-photo and spreadsheet buckets: two insert-only upload policies and the administrator read policy; no client update or delete');
select is((select array_agg(cmd order by cmd) from pg_policies where schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) like '%school-images%'),
  array['DELETE', 'INSERT', 'SELECT'], 'the school-image bucket (migration 20261014090001) has administrator-only insert, read and orphan-only delete');
select is((select bool_and(roles = array['authenticated']::name[] and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_admin') from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) like '%school-images%'), true, 'and every school-image policy requires the administrator');

-- Objects, as the trusted server would have written them (service_role bypasses RLS) -----------------------------------------------------------
set local role service_role;
insert into storage.objects (bucket_id, name) values
  ('school-uploads', '2026/FILE-2026-00001.xlsx'),
  ('student-photos', 'd0000000/photo-1.jpg');
reset role;

-- Anonymous ---------------------------------------------------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select count(*) from storage.objects)::int, 0, 'anon cannot list or read any object (RLS)');
select is((select count(*) from storage.objects where bucket_id = 'school-uploads')::int, 0, 'anon cannot see spreadsheets');
select is((select count(*) from storage.buckets)::int, 0, 'anon cannot even read bucket settings');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-uploads', 'evil.xlsx')$$, '42501', null, 'anon cannot upload');
with d as (delete from storage.objects returning 1) select is((select count(*) from d)::int, 0, 'anon cannot delete');
select throws_ok($$select * from public.uploaded_files$$, '42501', null, 'anon cannot read file records');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('x.csv', 'csv', 10)$$, '42501', null, 'anon cannot create file records');
reset role;

-- A signed-in user who is not the administrator ---------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects)::int, 0, 'a non-administrator cannot read any object');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-uploads', 'evil.xlsx')$$, '42501', null, 'a non-administrator cannot upload');
select is((select count(*) from public.uploaded_files)::int, 0, 'a non-administrator sees no file records');
reset role;

-- The administrator: read-only access to private objects ------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects)::int, 2, 'the administrator can read both private objects (what a signed URL needs)');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-uploads', 'admin-upload.xlsx')$$, '42501', null, 'the administrator cannot upload through the client either (Phase B server code does it)');
with d as (delete from storage.objects returning 1) select is((select count(*) from d)::int, 0, 'the administrator cannot delete objects from the client (retention decision D-RET is open)');
select is((select count(*) from storage.objects)::int, 2, 'the objects are still there');
reset role;

-- File records: written by trusted server code only --------------------------------------------------------------------------------------------------
set local role service_role;
with i as (insert into public.uploaded_files (reference_no, original_name, file_type, size_bytes) values ('FILE-1999-99999', 'class9.csv', 'csv', 2048) returning reference_no)
select is((select reference_no ~ '^FILE-[0-9]{4}-[0-9]{5}$' and reference_no <> 'FILE-1999-99999' from i), true, 'the reference number is generated (a supplied one is ignored)');
select is((select storage_state from public.uploaded_files limit 1), 'metadata_only', 'a new record is metadata_only: it does not claim contents exist');
select lives_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, storage_bucket, storage_path, storage_state, school_id, customer_name)
  values ('students.xlsx', 'xlsx', 254976, 'school-uploads', '2026/FILE-2026-00001.xlsx', 'stored', 'd0000000-0000-0000-0000-000000000001', 'File School')$$, 'a record for a real stored object is accepted');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, storage_state) values ('x.csv', 'csv', 10, 'stored')$$, '23514', null,
  'a "stored" record without a bucket and path is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, storage_bucket, storage_path) values ('x.csv', 'csv', 10, 'school-uploads', 'a/b.csv')$$, '23514', null,
  'a metadata-only record that points at a path is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('big.csv', 'csv', 10485761)$$, '23514', null, 'a file over 10 MB is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('empty.csv', 'csv', 0)$$, '23514', null, 'an empty file is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('a/b.csv', 'csv', 10)$$, '23514', null, 'a file name containing a path separator is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('x.pdf', 'pdf', 10)$$, '22P02', null, 'only xlsx, xls and csv are accepted');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, storage_bucket, storage_path, storage_state)
  values ('x.csv', 'csv', 10, 'school-uploads', '../../etc/passwd', 'stored')$$, '23514', null, 'a storage path that escapes its folder is rejected');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, storage_bucket, storage_path, storage_state)
  values ('x.csv', 'csv', 10, 'student-photos', 'a/b.csv', 'stored')$$, '23514', null, 'a spreadsheet record cannot point into the photo bucket');
reset role;

-- The administrator can read file metadata; nobody else can ------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.uploaded_files)::int, 2, 'the administrator can read file records');
select throws_ok($$update public.uploaded_files set storage_state = 'stored'$$, '42501', null, 'file records cannot be edited from the client');
select throws_ok($$delete from public.uploaded_files$$, '42501', null, 'file records cannot be deleted from the client');
reset role;

select * from finish();
rollback;
