-- School images (migration 20261014090001): private bucket, administrator-only upload and registration, one primary image.
begin;
select plan(41);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone) values
  ('d0000000-0000-4000-8000-000000000001', 'Image School', 'image-school', 'IMG-001', 'Test Person', '9000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'Other School', 'other-school', 'OTH-002', 'Test Person', '9000000002');
-- An object in an existing private bucket (as trusted server code would have written it).
insert into storage.objects (bucket_id, name) values ('student-photos', 'submissions/99999999-9999-4999-8999-999999999999.jpg');

-- ------------------------------------------------------------------ bucket
select is((select public from storage.buckets where id = 'school-images'), false, 'the school-image bucket is private');
select is((select file_size_limit from storage.buckets where id = 'school-images'), 5242880::bigint, 'school images are limited to 5 MB');
select is((select allowed_mime_types from storage.buckets where id = 'school-images'), array['image/jpeg', 'image/png', 'image/webp'], 'only JPEG, PNG and WebP (no SVG)');

-- ------------------------------------------------------------------ anonymous
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg')$$,
  '42501', null, 'anon cannot upload a school image');
select throws_ok($$select id from public.school_images$$, '42501', null, 'anon cannot read school image records');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001', 'x', 'x.jpg', repeat('a', 64))$$, '42501', null, 'anon cannot register an image');
select throws_ok($$select * from public.admin_set_primary_school_image('00000000-0000-0000-0000-000000000000')$$, '42501', null, 'anon cannot choose a primary image');
reset role;

-- ------------------------------------------------------------------ a signed-in non-administrator
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg')$$,
  '42501', null, 'a non-administrator cannot upload');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001', 'x', 'x.jpg', repeat('a', 64))$$, '42501', 'not_authorized', 'a non-administrator cannot register');
reset role;

-- ------------------------------------------------------------------ the administrator: upload
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg', '{"size": 1000, "mimetype": "image/jpeg"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.png', '{"size": 2000, "mimetype": "image/png"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.webp', '{"size": 3000, "mimetype": "image/webp"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.jpg', null),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.jpg', '{"size": 10, "mimetype": "image/svg+xml"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/66666666-6666-4666-8666-666666666666.jpg', '{"size": 10, "mimetype": "image/png"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.jpg', '{"size": 6000000, "mimetype": "image/jpeg"}'),
  ('school-images', 'schools/d0000000-0000-4000-8000-000000000002/88888888-8888-4888-8888-888888888888.jpg', '{"size": 10, "mimetype": "image/jpeg"}')$$,
  'the administrator uploads images into schools/<school id>/<random name>');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'logo.jpg')$$, '42501', null, 'not outside the schools/<id>/ folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/99999999-9999-4999-8999-999999999999.svg')$$,
  '42501', null, 'not an SVG');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('school-images', 'schools/d0000000-0000-4000-8000-000000000001/my-photo.jpg')$$,
  '42501', null, 'not a predictable file name');

-- ------------------------------------------------------------------ registration
select is((select is_primary::text || '|' || display_order from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg', 'Front gate.jpg', repeat('a', 64), '  Main gate  ')),
  'true|0', 'the first image of a school becomes the primary image');
select is((select is_primary::text || '|' || display_order from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.png', 'Hall.png', repeat('b', 64))),
  'false|1', 'later images are added after it, without replacing the primary image');
select lives_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.webp', 'Field.webp', repeat('c', 64))$$, 'WebP images are accepted');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.jpg', 'Copy.jpg', repeat('a', 64))$$, 'P0001', 'duplicate_image', 'the same image (checksum) cannot be added twice to a school');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.jpg', 'Again.jpg', repeat('d', 64))$$, '23505', null, 'an object that backs a record cannot be registered again');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000002/88888888-8888-4888-8888-888888888888.jpg', 'Wrong.jpg', repeat('e', 64))$$, '22023', 'invalid_image', 'an object in another school''s folder cannot be attached to this school');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/12121212-1212-4212-8212-121212121212.jpg', 'Missing.jpg', repeat('f', 64))$$, 'P0001', 'image_not_uploaded', 'an image that was never uploaded is refused');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/44444444-4444-4444-8444-444444444444.jpg', 'NoMeta.jpg', repeat('1', 64))$$, 'P0001', 'image_not_uploaded', 'an object with no recorded metadata is refused (fail closed)');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.jpg', 'Svg.jpg', repeat('2', 64))$$, '22023', 'invalid_image', 'an SVG stored under a .jpg name is refused');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/66666666-6666-4666-8666-666666666666.jpg', 'Mismatch.jpg', repeat('3', 64))$$, '22023', 'invalid_image', 'a stored type that does not match the extension is refused');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/77777777-7777-4777-8777-777777777777.jpg', 'Big.jpg', repeat('4', 64))$$, '22023', 'invalid_image', 'an image over 5 MB is refused');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-00000000dead',
  'schools/d0000000-0000-4000-8000-00000000dead/11111111-1111-4111-8111-111111111111.jpg', 'x.jpg', repeat('5', 64))$$, 'P0002', 'not_found', 'an unknown school is "not found"');
select throws_ok($$select * from public.admin_register_school_image('d0000000-0000-4000-8000-000000000001',
  'schools/d0000000-0000-4000-8000-000000000001/12121212-1212-4212-8212-121212121212.jpg', '../x.jpg', repeat('6', 64))$$, '22023', 'invalid_image', 'an unsafe original name is refused');
select throws_ok($$insert into public.school_images (school_id, storage_path, original_name, mime_type, size_bytes, content_sha256, display_order)
  values ('d0000000-0000-4000-8000-000000000001', 'schools/d0000000-0000-4000-8000-000000000001/13131313-1313-4313-8313-131313131313.jpg', 'x.jpg', 'image/jpeg', 1, repeat('7', 64), 9)$$,
  '42501', null, 'not even the administrator can write image records directly');
select throws_ok($$update public.school_images set is_primary = true$$, '42501', null, 'or change them directly');
select is((select alt_text || '|' || mime_type || '|' || size_bytes from public.school_images where original_name = 'Front gate.jpg'), 'Main gate|image/jpeg|1000',
  'the record keeps the trimmed alt text and the type and size Storage recorded');

-- ------------------------------------------------------------------ primary image
select is((select school_id from public.admin_set_primary_school_image((select id from public.school_images where original_name = 'Hall.png'))),
  'd0000000-0000-4000-8000-000000000001'::uuid, 'the administrator can choose another primary image');
select is((select string_agg(original_name, ',') from public.school_images where is_primary), 'Hall.png', 'and there is still exactly one primary image');
select is((select count(*) from public.school_images)::int, 3, 'no image was replaced or removed by changing the primary image');
select throws_ok($$select * from public.admin_set_primary_school_image((select id from public.school_images where original_name = 'Hall.png'))$$, 'P0001', 'no_change', 'choosing the current primary again is "no change"');
select throws_ok($$select * from public.admin_set_primary_school_image('00000000-0000-0000-0000-000000000000')$$, 'P0002', 'not_found', 'an unknown image is "not found"');

-- ------------------------------------------------------------------ reading and cleanup
select is((select count(*) from storage.objects where bucket_id = 'school-images')::int, 8, 'the administrator can read school images (what a signed URL needs)');
with d as (delete from storage.objects where name like '%11111111-1111-4111-8111-111111111111.jpg' returning 1)
select is((select count(*) from d)::int, 0, 'a registered image cannot be deleted from the client');
with d as (delete from storage.objects where name like '%44444444-4444-4444-8444-444444444444.jpg' returning 1)
select is((select count(*) from d)::int, 1, 'an unregistered upload (failed registration) can be cleaned up by the administrator');
with d as (delete from storage.objects where bucket_id = 'student-photos' returning 1)
select is((select count(*) from d)::int, 0, 'the existing private buckets still cannot be deleted from');
reset role;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.school_images)::int, 0, 'a non-administrator sees no image records');
select is((select count(*) from storage.objects where bucket_id = 'school-images')::int, 0, 'or images');
select throws_ok($$select * from public.admin_set_primary_school_image('00000000-0000-0000-0000-000000000000')$$, '42501', 'not_authorized', 'and cannot change a primary image (refused before any lookup)');
reset role;

select * from finish();
rollback;
