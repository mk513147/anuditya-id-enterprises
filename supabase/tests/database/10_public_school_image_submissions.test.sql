-- Public school-image submissions (migration 20261015090001): same bucket, table and duplicate rule as the administrator's
-- uploads; insert-only public folder; always pending; administrator review.
begin;
select plan(46);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone, is_active) values
  ('d0000000-0000-4000-8000-000000000001', 'Image School', 'image-school', 'IMG-001', 'Test Person', '9000000001', true),
  ('d0000000-0000-4000-8000-000000000002', 'Other School', 'other-school', 'OTH-002', 'Test Person', '9000000002', true),
  ('d0000000-0000-4000-8000-000000000003', 'Closed School', 'closed-school', 'CLS-003', 'Test Person', '9000000003', false);

-- An image the administrator uploaded earlier (checksum aaaa…), approved and primary, as migration 15 would have stored it.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into storage.objects (bucket_id, name, metadata) values
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg', '{"size": 100, "mimetype": "image/jpeg"}');
select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg', 'gate.jpg', repeat('a', 64));
reset role;
select is((select review_status::text || '|' || source || '|' || is_primary from public.school_images), 'approved|admin|true',
  'administrator uploads are approved immediately, exactly as before');

-- ------------------------------------------------------------------ anonymous: storage
set local role anon;
select set_config('request.jwt.claims', '', true);
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '.png', '{"size": 200, "mimetype": "image/png"}'),
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('a', 64) || '.jpg', '{"size": 100, "mimetype": "image/jpeg"}'),
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000002/' || repeat('b', 64) || '.png', '{"size": 200, "mimetype": "image/png"}'),
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000003/' || repeat('c', 64) || '.jpg', '{"size": 10, "mimetype": "image/jpeg"}'),
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('d', 64) || '.jpg', '{"size": 10, "mimetype": "image/svg+xml"}'),
  ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('e', 64) || '.jpg', null)$$,
  'anon can upload into submissions/<school>/<checksum>.<ext>');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '.png')$$,
  '23505', null, 'the same content-named object cannot be uploaded twice (no second copy)');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.jpg')$$,
  '42501', null, 'anon cannot write into the administrator folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/my-photo.jpg')$$,
  '42501', null, 'anon cannot choose an arbitrary name');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('f', 64) || '.svg')$$,
  '42501', null, 'anon cannot upload an SVG');
select is((select count(*) from storage.objects)::int, 0, 'anon cannot list or read (download) any school image, including its own uploads');
with u as (update storage.objects set name = name || 'x' returning 1) select is((select count(*) from u)::int, 0, 'anon cannot rename or replace an image');
with d as (delete from storage.objects returning 1) select is((select count(*) from d)::int, 0, 'anon cannot delete an image');

-- ------------------------------------------------------------------ anonymous: records and functions
select throws_ok($$select id from public.school_images$$, '42501', null, 'anon cannot list or read school-image records');
select is(public.school_image_already_present('d0000000-0000-4000-8000-000000000001', repeat('a', 64)), true, 'the pre-check confirms an image the school already has');
select is(public.school_image_already_present('d0000000-0000-4000-8000-000000000001', repeat('b', 64)), false, 'and says no for a new one');
select is(public.school_image_already_present('d0000000-0000-4000-8000-000000000001', 'not-a-checksum'), false, 'a malformed checksum matches nothing');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001', 'x', 'x.jpg', repeat('9', 64))$$, '42501', null, 'anon cannot use the administrator registration');
select throws_ok($$select * from public.admin_review_school_image('00000000-0000-0000-0000-000000000000', 'approved')$$, '42501', null, 'anon cannot review images');
select throws_ok($$select * from public.admin_set_primary_school_image('00000000-0000-0000-0000-000000000000')$$, '42501', null, 'anon cannot choose the primary image');

select is((select status from public.submit_school_image('d0000000-0000-4000-8000-000000000001', '  Asha Teacher ', '+91 98765 43210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '.png', 'hall.png', repeat('b', 64), '  For the prospectus cover  ')), 'submitted',
  'a public submission is registered');
select is((select status from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '.png', 'hall-again.png', repeat('b', 64))), 'already_present',
  'submitting the same image again (a retry or a double click) is a no-op: already present');
select is((select status from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Ravi', 'office@example.invalid',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('a', 64) || '.jpg', 'gate-copy.jpg', repeat('a', 64))), 'already_present',
  'an image the administrator already uploaded for the school is reported as already present, not stored again');
select is((select status from public.submit_school_image('d0000000-0000-4000-8000-000000000002', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000002/' || repeat('b', 64) || '.png', 'hall.png', repeat('b', 64))), 'submitted',
  'the same image can be submitted for a different school');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000003', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000003/' || repeat('c', 64) || '.jpg', 'x.jpg', repeat('c', 64))$$, 'P0001', 'school_unavailable', 'an inactive school is refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000002/' || repeat('b', 64) || '.png', 'x.png', repeat('b', 64))$$, '22023', 'invalid_image', 'another school''s object cannot be attached to this school');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '.png', 'x.png', repeat('7', 64))$$, '22023', 'invalid_image', 'the checksum must match the object name');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('d', 64) || '.jpg', 'x.jpg', repeat('d', 64))$$, '22023', 'invalid_image', 'an SVG stored under .jpg is refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('e', 64) || '.jpg', 'x.jpg', repeat('e', 64))$$, 'P0001', 'image_not_uploaded', 'an object with no recorded metadata is refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('6', 64) || '.jpg', 'x.jpg', repeat('6', 64))$$, 'P0001', 'image_not_uploaded', 'an image that was never uploaded is refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', '   ', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('6', 64) || '.jpg', 'x.jpg', repeat('6', 64))$$, '22023', 'invalid_input', 'a blank contact person is refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '12345',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('6', 64) || '.jpg', 'x.jpg', repeat('6', 64))$$, '22023', 'invalid_input', 'invalid contact details are refused');
select throws_ok($$select * from public.submit_school_image('d0000000-0000-4000-8000-000000000001', 'Asha Teacher', '9876543210',
  'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('6', 64) || '.jpg', 'x.jpg', repeat('6', 64), repeat('n', 501))$$, '22023', 'invalid_input', 'a note over 500 characters is refused');
select is((select count(*) from pg_proc p, unnest(p.proargnames) a where p.proname = 'submit_school_image' and a ~ '^p_.*(status|primary|review|order|alt|bucket)')::int, 0,
  'the public function has no parameter for review state, primary flag, order or bucket');
reset role;

select is((select review_status::text || '|' || source || '|' || is_primary || '|' || submitted_contact_person || '|' || submitted_contact_details || '|' || submission_note
  from public.school_images where original_name = 'hall.png' and school_id = 'd0000000-0000-4000-8000-000000000001'),
  'pending|public|false|Asha Teacher|9876543210|For the prospectus cover', 'a public submission is stored pending, never primary, with trimmed details');
select is((select count(*) from public.school_images)::int, 3, 'no duplicate record was created by the repeated or already-present submissions');

-- ------------------------------------------------------------------ a signed-in non-administrator
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.school_images)::int, 0, 'a non-administrator sees no image records');
select throws_ok($$select * from public.admin_review_school_image((select '00000000-0000-0000-0000-000000000000'::uuid), 'approved')$$, '42501', 'not_authorized', 'a non-administrator cannot review');
reset role;

-- ------------------------------------------------------------------ the administrator
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temp table t_img on commit drop as select id from public.school_images where original_name = 'hall.png' and school_id = 'd0000000-0000-4000-8000-000000000001';
grant select on t_img to authenticated;
set local role authenticated;
select is((select count(*) from public.school_images where review_status = 'pending')::int, 2, 'the administrator sees the pending submissions');
select is((select count(*) from storage.objects where bucket_id = 'school-images' and name like 'submissions/%')::int, 6, 'and can read the submitted objects (for review previews)');
select throws_ok($$select * from public.admin_set_primary_school_image((select id from t_img))$$, 'P0001', 'not_approved', 'a pending image cannot become primary');
select is((select review_status::text from public.admin_review_school_image((select id from t_img), 'approved')), 'approved', 'the administrator approves a submission');
select is((select (reviewed_at is not null)::text from public.school_images where id = (select id from t_img)), 'true', 'and the review time is recorded');
select lives_ok($$select * from public.admin_set_primary_school_image((select id from t_img))$$, 'an approved submission can then be made primary');
select throws_ok($$select * from public.admin_review_school_image((select id from t_img), 'rejected')$$, 'P0001', 'primary_image', 'the primary image cannot be rejected (choose another primary first)');
select is((select review_status::text from public.admin_review_school_image(
  (select id from public.school_images where school_id = 'd0000000-0000-4000-8000-000000000002'), 'rejected')), 'rejected', 'the administrator rejects a submission (kept for the record)');
select throws_ok($$select * from public.admin_review_school_image((select id from public.school_images where school_id = 'd0000000-0000-4000-8000-000000000002'), 'rejected')$$,
  'P0001', 'no_change', 'the same decision again is "no change"');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000002',
  'schools/d0000000-0000-4000-8000-000000000002/33333333-3333-4333-8333-333333333333.png', 'again.png', repeat('b', 64))$$, 'P0001', 'duplicate_image',
  'the administrator uploader shares the duplicate rule: an image already submitted (even rejected) is not added twice');
select throws_ok($$update public.school_images set review_status = 'approved'$$, '42501', null, 'the review state changes only through the review function');
with d as (delete from storage.objects where name like 'submissions/d0000000-0000-4000-8000-000000000001/' || repeat('b', 64) || '%' returning 1)
select is((select count(*) from d)::int, 0, 'a registered submission cannot be deleted from the client');
reset role;

select * from finish();
rollback;
