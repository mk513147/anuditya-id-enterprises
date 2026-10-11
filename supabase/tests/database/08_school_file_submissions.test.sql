-- School data file submissions (migration 20261013090001): public submission limits, privacy, and the administrator review.
begin;
select plan(47);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone, is_active) values
  ('d0000000-0000-0000-0000-000000000001', 'Open School', 'open-school', 'OPN-001', 'Test Person', '9000000001', true),
  ('d0000000-0000-0000-0000-000000000002', 'Closed School', 'closed-school', 'CLS-002', 'Test Person', '9000000002', false);

-- ------------------------------------------------------------------ anonymous submission
set local role anon;
select set_config('request.jwt.claims', '', true);
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values
  ('school-uploads', 'incoming/11111111-1111-4111-8111-111111111111.xlsx', '{"size": 5000, "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'),
  ('school-uploads', 'incoming/22222222-2222-4222-8222-222222222222.csv', '{"size": 300, "mimetype": "text/csv"}'),
  ('school-uploads', 'incoming/33333333-3333-4333-8333-333333333333.csv', '{"size": 300, "mimetype": "text/csv"}')$$,
  'anon uploads three spreadsheets into the fixed folder');

select is((select school_name || '|' || original_name || '|' || size_bytes from public.submit_school_file(
  'd0000000-0000-0000-0000-000000000001', '  Asha Teacher  ', '+91 98765-43210', 'student_data',
  'Student list for the 2026-27 session, Class 10, for ID card printing.',
  'incoming/11111111-1111-4111-8111-111111111111.xlsx', 'Class 10.xlsx', '  Needed by Friday  ')),
  'Open School|Class 10.xlsx|5000', 'a complete submission is registered with its school and the size Storage recorded');

select is((select array_agg(k order by k) from public.submit_school_file(
  'd0000000-0000-0000-0000-000000000001', 'Ravi Clerk', 'Office@Example.INVALID', 'design_materials',
  'Logo and colour codes for the 2026 school diary cover.',
  'incoming/22222222-2222-4222-8222-222222222222.csv', 'colours.csv') r, jsonb_object_keys(to_jsonb(r)) k),
  array['file_type', 'original_name', 'reference_no', 'school_name', 'size_bytes', 'uploaded_at'],
  'the public result carries no contact details, description, review state or storage path');

select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000002', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  'P0001', 'school_unavailable', 'an inactive school cannot receive submissions');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-00000000dead', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  'P0001', 'school_unavailable', 'an unknown school cannot receive submissions');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', '   ', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_input', 'a blank contact person is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '12345', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_input', 'contact details that are neither a mobile number nor an email are refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', 'a@b', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_input', 'an incomplete email is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'other',
  'Too short', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_input', 'a description under 20 characters is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv', repeat('x', 1001))$$,
  '22023', 'invalid_input', 'instructions over 1000 characters are refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', null,
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_input', 'a missing category is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'approved',
  'A description that is long enough to pass.', 'incoming/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22P02', null, 'a category outside the list is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/11111111-1111-4111-8111-111111111111.xlsx', 'again.xlsx')$$,
  '23505', null, 'an object that already backs a submission cannot be registered again');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'incoming/44444444-4444-4444-8444-444444444444.csv', 'x.csv')$$,
  'P0001', 'file_not_uploaded', 'a path with no uploaded object is refused');
select throws_ok($$select * from public.submit_school_file('d0000000-0000-0000-0000-000000000001', 'Asha Teacher', '9876543210', 'other',
  'A description that is long enough to pass.', 'submissions/33333333-3333-4333-8333-333333333333.csv', 'x.csv')$$,
  '22023', 'invalid_file', 'a path outside the upload folder is refused');
select is((select count(*) from pg_proc p, unnest(p.proargnames) a where p.proname = 'submit_school_file' and a ~ '(status|review|reviewed|notes|bucket)')::int, 0,
  'the public function has no parameter for the review state, reviewer, notes or bucket');

select throws_ok($$select id from public.uploaded_files$$, '42501', null, 'anon cannot read file records');
select throws_ok($$select id from public.uploaded_file_reviews$$, '42501', null, 'anon cannot read review history');
select throws_ok($$update public.uploaded_files set review_status = 'approved'$$, '42501', null, 'anon cannot change a review state directly');
select throws_ok($$select * from public.admin_review_file('00000000-0000-0000-0000-000000000000', 'approved')$$, '42501', null, 'anon cannot call admin_review_file');
select is((select count(*) from storage.objects)::int, 0, 'anon cannot list or read (download) any uploaded object, including known paths');
reset role;

select is((select review_status::text || '|' || contact_person || '|' || contact_details || '|' || category::text || '|' || instructions
  from public.uploaded_files where storage_path like '%11111111%'),
  'pending|Asha Teacher|9876543210|student_data|Needed by Friday', 'stored as pending, trimmed, with the mobile number normalised');
select is((select contact_details || '|' || coalesce(instructions, 'null') from public.uploaded_files where storage_path like '%22222222%'),
  'office@example.invalid|null', 'an email is lower-cased; blank instructions are stored as null');

-- ------------------------------------------------------------------ a signed-in non-administrator
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.uploaded_files)::int, 0, 'a non-administrator sees no file records');
select throws_ok($$select * from public.admin_review_file((select id from public.uploaded_files limit 1), 'approved')$$, '42501', 'not_authorized',
  'a non-administrator cannot review');
reset role;

-- ------------------------------------------------------------------ the administrator
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temp table t_file on commit drop as select id from public.uploaded_files where storage_path like '%11111111%';
grant select on t_file to authenticated;
set local role authenticated;
select is((select contact_details from public.uploaded_files where id = (select id from t_file)), '9876543210', 'the administrator can read the contact details');
select is((select count(*) from storage.objects where bucket_id = 'school-uploads')::int, 3, 'the administrator can read the stored objects (what a signed download link needs)');
select throws_ok($$update public.uploaded_files set review_status = 'approved'$$, '42501', null, 'not even the administrator can change the review state except through admin_review_file');
select is((select review_status::text from public.admin_review_file((select id from t_file), 'approved', '  Looks good  ')), 'approved', 'the administrator approves');
select is((select review_notes || '|' || (reviewed_at is not null)::text || '|' || reviewed_by::text from public.uploaded_files where id = (select id from t_file)),
  'Looks good|true|a0000000-0000-0000-0000-000000000001', 'notes are trimmed, and the review time and reviewer are recorded');
select throws_ok($$select * from public.admin_review_file((select id from t_file), 'approved', 'Looks good')$$, 'P0001', 'no_change', 'the same decision with the same notes is "no change"');
select lives_ok($$select * from public.admin_review_file((select id from t_file), 'approved', 'Looks good. Printing on Monday.')$$, 'notes can be updated without changing the decision');
select is((select review_status::text from public.admin_review_file((select id from t_file), 'corrections_required', 'Class 10 B is missing.')), 'corrections_required', 'the administrator can request corrections');
select is((select review_status::text from public.admin_review_file((select id from t_file), 'rejected', null)), 'rejected', 'and reject');
select is((select r.review_status::text from public.admin_review_file((select id from t_file), 'pending', '') r), 'pending', 'the administrator can return a file to pending');
select is((select (f.reviewed_at is null)::text || '|' || coalesce(f.reviewed_by::text, 'none') || '|' || coalesce(f.review_notes, 'none')
  from public.uploaded_files f where f.id = (select id from t_file)),
  'true|none|none', 'returning to pending clears the review time, reviewer and notes');
select is((select string_agg(review_status::text, ',' order by id) from public.uploaded_file_reviews where file_id = (select id from t_file)),
  'approved,approved,corrections_required,rejected,pending', 'every decision is kept in the review history');
select throws_ok($$select * from public.admin_review_file('00000000-0000-0000-0000-000000000000', 'approved')$$, 'P0002', 'not_found', 'an unknown file is "not found"');
select throws_ok($$select * from public.admin_review_file((select id from t_file), 'approved', repeat('x', 1001))$$, '22023', 'invalid_input', 'notes over 1000 characters are refused');
select is((public.admin_summary() -> 'files' ->> 'pendingReview')::int, 2, 'the summary counts files waiting for review');
select is((select count(*) from jsonb_object_keys(public.admin_summary() -> 'files' -> 'byReview'))::int, 4, 'and has a count for every review state');
select is((public.admin_summary()::text ~ '(9876543210|example\.invalid|Asha|Looks good|incoming/)'), false, 'the summary contains no contact details, notes or storage paths');
reset role;

-- ------------------------------------------------------------------ unregistered uploads (orphans) are counted for cleanup
insert into storage.objects (bucket_id, name, metadata, created_at) values
  ('school-uploads', 'incoming/55555555-5555-4555-8555-555555555555.csv', '{"size": 10, "mimetype": "text/csv"}', now() - interval '2 hours'),
  ('student-photos', 'submissions/66666666-6666-4666-8666-666666666666.jpg', '{"size": 10, "mimetype": "image/jpeg"}', now() - interval '2 hours');
set local role authenticated;
select is((public.admin_summary() -> 'storage' ->> 'unregisteredUploads')::int, 2,
  'objects older than an hour that no record uses are counted (a fresh, still-unregistered upload is not)');
reset role;

-- ------------------------------------------------------------------ records made before this migration
select lives_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes) values ('legacy.csv', 'csv', 10)$$,
  'a record without submission details (as before this migration) is still valid');
select is((select review_status::text from public.uploaded_files where original_name = 'legacy.csv'), 'pending', 'and starts as pending');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, contact_person) values ('half.csv', 'csv', 10, 'Only A Name')$$,
  '23514', null, 'a half-filled submission is impossible');
select throws_ok($$insert into public.uploaded_files (original_name, file_type, size_bytes, review_status) values ('odd.csv', 'csv', 10, 'approved')$$,
  '23514', null, 'a decision without a review time is impossible');

select * from finish();
rollback;
