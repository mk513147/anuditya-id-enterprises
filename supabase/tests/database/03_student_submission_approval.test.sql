-- Student submissions: always pending, never readable by the public, approved only by the administrator.
begin;
select plan(51);

-- Fixtures (fictional) ----------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone, is_active) values
  ('d0000000-0000-0000-0000-000000000001', 'Active School', 'active-school', 'ACT-001', 'Test Person', '9000000001', true),
  ('d0000000-0000-0000-0000-000000000002', 'Closed School', 'closed-school', 'CLS-002', 'Test Person', '9000000002', false),
  ('d0000000-0000-0000-0000-000000000003', 'Other School', 'other-school', 'OTH-003', 'Test Person', '9000000003', true);

-- Anonymous visitors ---------------------------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select reference_no ~ '^ANU-[0-9]{4}-[0-9]{5}$' from public.submit_student(
  'd0000000-0000-0000-0000-000000000001', 'Test Student', 'Test Father', 'Test Mother', date '2012-04-12', 'Class 6', 'a', '12', 'ADM/1', '1 Sample Road, Demo Town', '9000000011')),
  true, 'a valid public submission succeeds and returns a reference number in the ANU-YYYY-NNNNN format');
select is((select school_name from public.submit_student(
  'd0000000-0000-0000-0000-000000000001', 'Second Student', 'Test Father', 'Test Mother', date '2012-04-12', 'Class 6', 'B', '13', 'ADM/2', '1 Sample Road, Demo Town', '9000000012')),
  'Active School', 'the confirmation names the school');

select throws_ok($$select * from public.students$$, '42501', null, 'anon cannot read students');
select throws_ok($$select count(*) from public.students$$, '42501', null, 'anon cannot even count students');
select throws_ok($$insert into public.students (school_id, name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile, approval_status, reviewed_at)
  values ('d0000000-0000-0000-0000-000000000001', 'Direct Insert', 'F', 'M', date '2012-01-01', 'Class 1', 'A', '1', 'X1', '1 Sample Road, Demo Town', '9000000013', 'approved', now())$$,
  '42501', null, 'anon cannot insert directly, so cannot choose "approved"');
select throws_ok($$update public.students set approval_status = 'approved'$$, '42501', null, 'anon cannot update students');

select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000002', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X2', '1 Sample Road, Demo Town', '9000000014')$$,
  'P0001', 'school_unavailable', 'submitting to an inactive school is refused');
select throws_ok($$select * from public.submit_student('99999999-9999-9999-9999-999999999999', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X3', '1 Sample Road, Demo Town', '9000000014')$$,
  'P0001', 'school_unavailable', 'an unknown school gets the same refusal (nothing to learn)');
select throws_ok($$select * from public.submit_student(null, 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X4', '1 Sample Road, Demo Town', '9000000014')$$,
  'P0001', 'school_unavailable', 'a missing school is refused');

-- Validation is enforced by the database, not only the browser ------------------------------------------------------------------------
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X5', '1 Sample Road, Demo Town', '12345')$$,
  '23514', null, 'an invalid mobile number is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', current_date + 1, 'Class 6', 'A', '1', 'X6', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a date of birth in the future is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '1970-01-01', 'Class 6', 'A', '1', 'X7', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a date of birth before 1980 is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 13', 'A', '1', 'X8', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a class outside the list is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'TOOLONG', '1', 'X9', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a section longer than five characters is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Student 123', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X10', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a name containing digits is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', '<script>', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X11', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'markup characters in a name are rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', 'bad roll!', 'X12', '1 Sample Road, Demo Town', '9000000014')$$,
  '23514', null, 'a roll number with unexpected characters is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X13', 'short', '9000000014')$$,
  '23514', null, 'an address shorter than ten characters is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X14', '1 Sample Road, Demo Town', '9000000014', 'Z+')$$,
  '23514', null, 'an invalid blood group is rejected');
select throws_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Test Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X15', '1 Sample Road, Demo Town', '9000000014', null, null, null, null, null, '../escape.jpg')$$,
  '22023', 'invalid_photo', 'a photo path that tries to leave its folder is rejected (by submit_student since Phase 3; the CHECK still backs it)');
select lives_ok($$select * from public.submit_student('d0000000-0000-0000-0000-000000000001', 'Optional Fields', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'X16', '1 Sample Road, Demo Town', '9000000015', 'O+', 'Red', 'Red', 'R-7', 'Main Gate', null)$$,
  'optional details are accepted');
reset role;

-- What was stored -----------------------------------------------------------------------------------------------------------------------
select is((select count(*) from public.students)::int, 3, 'only the three valid submissions were stored (invalid ones left nothing behind)');
select is((select count(*) from public.students where approval_status = 'pending' and reviewed_at is null)::int, 3, 'every submission is pending and unreviewed');
select is((select section from public.students where admission_no = 'ADM/1'), 'A', 'the section is stored upper-case');
select is((select count(distinct reference_no) from public.students)::int, 3, 'every submission has a unique reference number');
select is((select (array_agg(reference_no order by submitted_at, reference_no))[1] < (array_agg(reference_no order by submitted_at, reference_no))[2] from public.students), true,
  'reference numbers increase');
select is((select school_name is not null from public.submit_student('d0000000-0000-0000-0000-000000000003', 'Third Student', 'F', 'M', date '2012-04-12', 'Class 6', 'A', '1', 'ADM/1', '1 Sample Road, Demo Town', '9000000016')),
  true, 'the same admission number may be submitted again (ASSUMPTION D-ADM: not enforced on submission, matching today''s behaviour)');

-- A signed-in stranger --------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.students)::int, 0, 'a signed-in user who is not the administrator sees no students');
select throws_ok($$select * from public.admin_review_student((select id from public.students limit 1), 'approved')$$, '42501', 'not_authorized',
  'a non-administrator cannot approve a submission');
select throws_ok($$insert into public.students (school_id, name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile)
  values ('d0000000-0000-0000-0000-000000000001', 'Direct Insert', 'F', 'M', date '2012-01-01', 'Class 1', 'A', '1', 'X1', '1 Sample Road, Demo Town', '9000000013')$$,
  '42501', null, 'a signed-in user cannot insert students either');
reset role;

-- The administrator -----------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.students where approval_status = 'pending')::int, 4, 'the administrator sees all pending submissions');
select set_config('test.student', (select id::text from public.students where admission_no = 'ADM/2'), true);

select is((select approval_status from public.admin_review_student(current_setting('test.student')::uuid, 'approved')), 'approved', 'the administrator approves a submission');
select is((select reviewed_at is not null from public.students where id = current_setting('test.student')::uuid), true, 'approval records the review time');
select throws_ok($$select * from public.admin_review_student(current_setting('test.student')::uuid, 'approved')$$, 'P0001', 'no_change', 'approving twice is reported, not silently repeated');
select is((select approval_status from public.admin_review_student(current_setting('test.student')::uuid, 'rejected')), 'rejected', 'a decision can be changed to rejected');
select is((select reviewed_at is not null from public.students where id = current_setting('test.student')::uuid), true, 'a rejected submission keeps its review time and its record (ASSUMPTION D-REJ: never deleted)');
select is((select reviewed_at is null from public.admin_review_student(current_setting('test.student')::uuid, 'pending')), true, 'a decision can be sent back to pending (review time cleared)');
select throws_ok($$select * from public.admin_review_student('99999999-9999-9999-9999-999999999999', 'approved')$$, 'P0002', 'not_found', 'reviewing a missing student is reported');

-- Direct writes are limited to the whitelisted columns ----------------------------------------------------------------------------------------
select throws_ok($$update public.students set approval_status = 'approved' where id = current_setting('test.student')::uuid$$, '42501', null,
  'the administrator cannot bypass the review function by updating the status column');
select throws_ok($$update public.students set reference_no = 'ANU-2000-00001' where id = current_setting('test.student')::uuid$$, '42501', null, 'the reference number cannot be updated');
select throws_ok($$update public.students set school_id = 'd0000000-0000-0000-0000-000000000003' where id = current_setting('test.student')::uuid$$, '42501', null, 'the school cannot be changed');
select lives_ok($$update public.students set name = 'Renamed Student', mobile = '9000000099' where id = current_setting('test.student')::uuid$$, 'the administrator can edit the editable fields');
select lives_ok($$update public.students set archived_at = now() where id = current_setting('test.student')::uuid$$, 'the administrator can archive a student');
select lives_ok($$update public.students set archived_at = null where id = current_setting('test.student')::uuid$$, 'and restore it');
select throws_ok($$delete from public.students$$, '42501', null, 'students can never be deleted through the API');
select throws_ok($$update public.students set mobile = '123' where id = current_setting('test.student')::uuid$$, '23514', null, 'edits are validated by the database too');

-- Admission-number rule when an admin CHANGES it (today''s behaviour) --------------------------------------------------------------------------
select throws_ok($$update public.students set admission_no = 'adm/1' where admission_no = 'ADM/2' and school_id = 'd0000000-0000-0000-0000-000000000001'$$, '23505', 'duplicate_admission_no',
  'changing an admission number to one already used in the same school is refused (case-insensitive)');
select lives_ok($$update public.students set name = 'Still Editable' where admission_no = 'ADM/1' and school_id = 'd0000000-0000-0000-0000-000000000003'$$,
  'an unchanged number is never re-checked, so existing duplicates stay editable');
select lives_ok($$update public.students set admission_no = 'ADM/9' where admission_no = 'ADM/2'$$, 'a free admission number is accepted');
reset role;

-- Immutable columns, even for the owner -------------------------------------------------------------------------------------------------------
select throws_ok($$update public.students set reference_no = 'ANU-2000-00001'$$, '42501', null, 'the trigger also protects the reference number from the owner');
select throws_ok($$update public.students set submitted_at = now() - interval '1 year'$$, '42501', null, 'and the submission time');

select * from finish();
rollback;
