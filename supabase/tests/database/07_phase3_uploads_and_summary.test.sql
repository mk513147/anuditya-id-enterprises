-- Phase 3: insert-only public uploads, registering uploads, photo validation on submission, and the admin summary.
begin;
select plan(41);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone) values
  ('d0000000-0000-0000-0000-000000000001', 'Upload School', 'upload-school', 'UPL-001', 'Test Person', '9000000001');

-- ------------------------------------------------------------------ anonymous uploads: insert-only, fixed folder, random name
set local role anon;
select set_config('request.jwt.claims', '', true);
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values ('student-photos', 'submissions/11111111-1111-4111-8111-111111111111.jpg', '{"size": 1000, "mimetype": "image/jpeg"}')$$,
  'anon can upload a photo to submissions/<uuid>.jpg');
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values ('school-uploads', 'incoming/22222222-2222-4222-8222-222222222222.csv', '{"size": 2048, "mimetype": "text/csv"}')$$,
  'anon can upload a spreadsheet to incoming/<uuid>.csv');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('student-photos', 'evil.jpg')$$, '42501', null, 'anon cannot upload a photo outside submissions/');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('student-photos', 'submissions/not-a-uuid.jpg')$$, '42501', null, 'anon cannot choose a predictable name');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('student-photos', 'submissions/11111111-1111-4111-8111-111111111112.svg')$$, '42501', null, 'anon cannot upload a photo with another extension');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-uploads', 'incoming/22222222-2222-4222-8222-222222222223.exe')$$, '42501', null, 'anon cannot upload an executable');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-uploads', 'submissions/33333333-3333-4333-8333-333333333333.jpg')$$, '42501', null, 'anon cannot put a photo-style path into the spreadsheet bucket');
select is((select count(*) from storage.objects)::int, 0, 'anon still cannot list or read any object, including its own upload');
with u as (update storage.objects set name = 'submissions/11111111-1111-4111-8111-111111111111.png' returning 1) select is((select count(*) from u)::int, 0, 'anon cannot rename or overwrite an object');
with d as (delete from storage.objects returning 1) select is((select count(*) from d)::int, 0, 'anon cannot delete an object');

-- ------------------------------------------------------------------ registering a spreadsheet upload
select is((select reference_no ~ '^FILE-[0-9]{4}-[0-9]{5}$' from public.submit_file_upload('incoming/22222222-2222-4222-8222-222222222222.csv', 'Class 9 list.csv')), true,
  'a real upload is registered and gets a FILE- reference');
select throws_ok($$select * from public.submit_file_upload('incoming/22222222-2222-4222-8222-222222222222.csv', 'again.csv')$$, '23505', null, 'the same object cannot be registered twice');
select throws_ok($$select * from public.submit_file_upload('incoming/44444444-4444-4444-8444-444444444444.csv', 'missing.csv')$$, 'P0001', 'file_not_uploaded', 'a path with no uploaded object is refused');
select throws_ok($$select * from public.submit_file_upload('../etc/passwd', 'x.csv')$$, '22023', 'invalid_file', 'an unexpected path is refused');
select throws_ok($$select * from public.submit_file_upload('incoming/22222222-2222-4222-8222-222222222222.csv', 'renamed.xlsx')$$, '22023', 'invalid_file', 'the file name must match the stored type');
reset role;
insert into storage.objects (bucket_id, name, metadata) values
  ('school-uploads', 'incoming/88888888-8888-4888-8888-888888888888.csv', null),
  ('school-uploads', 'incoming/99999999-9999-4999-8999-999999999999.csv', '{"size": 10, "mimetype": "text/html"}');
set local role anon;
select throws_ok($$select * from public.submit_file_upload('incoming/88888888-8888-4888-8888-888888888888.csv', 'a.csv')$$, 'P0001', 'file_not_uploaded', 'an object with no recorded metadata is treated as not uploaded (fail closed)');
select throws_ok($$select * from public.submit_file_upload('incoming/99999999-9999-4999-8999-999999999999.csv', 'b.csv')$$, '22023', 'invalid_file', 'an object whose stored type is not a spreadsheet type is refused');
select throws_ok($$select * from public.uploaded_files$$, '42501', null, 'anon still cannot read file records');
reset role;
select is((select storage_state || '|' || storage_bucket || '|' || size_bytes from public.uploaded_files), 'stored|school-uploads|2048', 'the record says stored, with the real bucket and the size reported by storage');

-- ------------------------------------------------------------------ submitting a student with a photo
set local role anon;
select is((select reference_no ~ '^ANU-' from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Photo Student', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '1', 'ADM-P1', '1 Sample Road, Demo Town', '9000000011', null, null, null, null, null,
  'submissions/11111111-1111-4111-8111-111111111111.jpg')), true, 'a submission with a real uploaded photo succeeds');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Second Student', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '2', 'ADM-P2', '1 Sample Road, Demo Town', '9000000012', null, null, null, null, null,
  'submissions/11111111-1111-4111-8111-111111111111.jpg')$$, '22023', 'invalid_photo', 'another submission cannot reuse that photo');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Third Student', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '3', 'ADM-P3', '1 Sample Road, Demo Town', '9000000013', null, null, null, null, null,
  'submissions/55555555-5555-4555-8555-555555555555.jpg')$$, 'P0001', 'photo_not_uploaded', 'a photo path with no uploaded object is refused');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Fourth Student', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '4', 'ADM-P4', '1 Sample Road, Demo Town', '9000000014', null, null, null, null, null,
  'incoming/22222222-2222-4222-8222-222222222222.csv')$$, '22023', 'invalid_photo', 'a spreadsheet cannot be used as a photo');
select lives_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'No Photo', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '5', 'ADM-P5', '1 Sample Road, Demo Town', '9000000015')$$,
  'a submission without a photo still works (the browser form requires one; the database does not, as before)');
reset role;
insert into storage.objects (bucket_id, name, metadata) values ('student-photos', 'submissions/66666666-6666-4666-8666-666666666666.png', '{"size": 3000000, "mimetype": "image/png"}');
insert into storage.objects (bucket_id, name, metadata) values ('student-photos', 'submissions/77777777-7777-4777-8777-777777777777.jpg', '{"size": 100, "mimetype": "application/pdf"}');
insert into storage.objects (bucket_id, name, metadata) values ('student-photos', 'submissions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', null);
insert into storage.objects (bucket_id, name, metadata) values ('student-photos', 'submissions/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg', '{"size": 100}');
set local role anon;
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Big Photo', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '6', 'ADM-P6', '1 Sample Road, Demo Town', '9000000016', null, null, null, null, null,
  'submissions/66666666-6666-4666-8666-666666666666.png')$$, '22023', 'invalid_photo', 'a photo over 2 MB (as reported by storage) is refused');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Wrong Type', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '7', 'ADM-P7', '1 Sample Road, Demo Town', '9000000017', null, null, null, null, null,
  'submissions/77777777-7777-4777-8777-777777777777.jpg')$$, '22023', 'invalid_photo', 'an object whose stored type is not an image is refused');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'No Meta', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '8', 'ADM-P8', '1 Sample Road, Demo Town', '9000000018', null, null, null, null, null,
  'submissions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$$, 'P0001', 'photo_not_uploaded', 'a photo with no recorded metadata is refused (fail closed)');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'No Type', 'F Name', 'M Name', date '2012-01-01', 'Class 6', 'A', '9', 'ADM-P9', '1 Sample Road, Demo Town', '9000000019', null, null, null, null, null,
  'submissions/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg')$$, 'P0001', 'photo_not_uploaded', 'a photo whose stored type is unknown is refused (fail closed)');
reset role;
select is((select approval_status::text || '|' || photo_path from public.students where name = 'Photo Student'), 'pending|submissions/11111111-1111-4111-8111-111111111111.jpg',
  'the stored submission is pending and points at the uploaded photo');

-- ------------------------------------------------------------------ the administrator summary
set local role anon;
select throws_ok($$select public.admin_summary()$$, '42501', null, 'anon cannot call admin_summary');
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.admin_summary()$$, '42501', 'not_authorized', 'a signed-in non-administrator is refused');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((public.admin_summary() -> 'students' ->> 'pending')::int, 2, 'the summary counts pending submissions');
select is((public.admin_summary() -> 'files' ->> 'total')::int, 1, 'the summary counts file records');
select is((public.admin_summary() -> 'files' ->> 'stored')::int, 1, 'and stored files');
select is((public.admin_summary() -> 'orders' -> 'byStatus' ->> 'Delivered')::int, 0, 'order counts exist for every status');
select is((select count(*) from jsonb_object_keys(public.admin_summary() -> 'orders' -> 'byStatus'))::int, 8, 'all eight statuses are present');
select is((public.admin_summary() -> 'schools' ->> 'active')::int, 1, 'the summary counts active schools');
select is(jsonb_array_length(public.admin_summary() -> 'recentSchools'), 1, 'recent schools are listed');
select is((select array_agg(k order by k) from jsonb_object_keys(public.admin_summary() -> 'recentSchools' -> 0) k), array['code', 'created_at', 'id', 'is_active', 'name', 'student_count'],
  'recent schools carry only the fields the dashboard shows (no contact details)');
select is(public.admin_summary() -> 'studentSections', '["A"]'::jsonb, 'distinct sections are listed for the student filter');
select is((public.admin_summary()::text ~ '(password|tracking_secret|tracking_code|photo_path|storage_path|internal_notes|mobile|father_name|dob|admission_no)'), false,
  'the summary contains counts and school display data only, no student, order or storage private fields');
reset role;

select * from finish();
rollback;
