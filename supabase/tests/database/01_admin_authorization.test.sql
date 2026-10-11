-- Single administrator model: one admin, no self-assignment, no client writes to profiles, admin-only functions.
-- All fixtures are fictional and rolled back at the end.
begin;
select plan(28);

-- Fixtures (as the database owner): the admin's auth user, an ordinary signed-in user and a school.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid'),
  ('c0000000-0000-0000-0000-000000000003', 'second@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone)
  values ('d0000000-0000-0000-0000-000000000001', 'Test School', 'test-school', 'TST-001', 'Test Person', '9000000001');

-- The single-administrator rule ------------------------------------------------------------------------------------------
select is((select count(*) from public.profiles where role = 'admin')::int, 1, 'there is exactly one administrator profile');
select throws_ok($$select private.provision_administrator('c0000000-0000-0000-0000-000000000003')$$, '23505', 'an administrator already exists',
  'a second administrator cannot be provisioned');
select lives_ok($$select private.provision_administrator('a0000000-0000-0000-0000-000000000001')$$, 'provisioning the same administrator again is harmless');
select throws_ok($$insert into public.profiles (id, role) values ('c0000000-0000-0000-0000-000000000003', 'admin')$$, '23505', null,
  'a second admin row is rejected by the unique index even when inserted directly');
select throws_ok($$select private.provision_administrator('99999999-9999-9999-9999-999999999999')$$, 'P0002', 'no auth user with that id',
  'provisioning requires a real auth user');

-- A request carrying a user's token can never create or alter a profile (trigger = defence in depth) ---------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$insert into public.profiles (id, role) values ('b0000000-0000-0000-0000-000000000002', 'admin')$$, '42501', null,
  'even the owner connection cannot insert a profile while a user token is present');
select set_config('request.jwt.claims', '', true);


-- Anonymous --------------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select private.is_admin()$$, '42501', null, 'anon cannot call private helpers directly (no USAGE on the private schema)');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$insert into public.profiles (id, role) values ('b0000000-0000-0000-0000-000000000002', 'admin')$$, '42501', null,
  'anon cannot insert a profile (cannot make itself administrator)');
select throws_ok($$select * from public.schools$$, '42501', null, 'anon cannot read schools directly');
select throws_ok($$select * from public.students$$, '42501', null, 'anon cannot read students');
select throws_ok($$select public.admin_set_order_status('d0000000-0000-0000-0000-000000000009', 'Printing')$$, '42501', null,
  'anon cannot call administrator functions');
reset role;

-- A signed-in user who is NOT the administrator ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select private.is_admin()$$, '42501', null, 'a signed-in user cannot call private helpers directly either');
reset role;
select is(private.is_admin(), false, 'an ordinary signed-in user is not an administrator (evaluated by the owner with their token)');
set local role authenticated;
select is((select count(*) from public.profiles)::int, 0, 'an ordinary user sees no profile rows');
select is((select count(*) from public.schools)::int, 0, 'an ordinary signed-in user sees no schools (RLS)');
select throws_ok($$insert into public.profiles (id, role) values ('b0000000-0000-0000-0000-000000000002', 'admin')$$, '42501', null,
  'an ordinary user cannot make themselves administrator');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, 'an ordinary user cannot update roles');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Bad School', 'bad-school', 'BAD-1', 'Nobody', '9000000009')$$, '42501', null,
  'an ordinary user cannot create a school (RLS with-check)');
select throws_ok($$select public.admin_create_order(null, 'X', 'Student ID Card', 1, current_date, current_date, null)$$, '42501', 'not_authorized',
  'an ordinary user is refused by administrator functions');
reset role;

-- The administrator -------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
reset role;
select is(private.is_admin(), true, 'the administrator is recognised (evaluated by the owner with their token)');
set local role authenticated;
select is((select count(*) from public.profiles)::int, 1, 'the administrator can read their own profile');
select is((select count(*) from public.schools)::int, 1, 'the administrator can read schools');
select throws_ok($$update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null,
  'even the administrator cannot modify a profile through the API');
select throws_ok($$delete from public.schools$$, '42501', null, 'the administrator cannot delete schools (no DELETE privilege)');
select lives_ok($$update public.schools set contact_person = 'New Person' where code = 'TST-001'$$, 'the administrator can edit a school');
reset role;

-- Deleting the auth user removes the profile, so the administrator account can be replaced deliberately ------------------
select lives_ok($$delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001'$$, 'owner can remove the old auth user');
select is((select count(*) from public.profiles)::int, 0, 'the profile row goes with its auth user, so a replacement administrator can then be provisioned');

select * from finish();
rollback;
