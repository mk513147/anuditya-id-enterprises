-- Anonymous access: only the narrowly scoped public functions work, and they never expose hidden rows or private columns.
begin;
select plan(37);

-- Fixtures (fictional) ------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');

insert into public.schools (id, name, slug, code, contact_person, phone, email, address, is_active) values
  ('d0000000-0000-0000-0000-000000000001', 'Active School', 'active-school', 'ACT-001', 'Private Person', '9000000001', 'private@example.invalid', '1 Private Road', true),
  ('d0000000-0000-0000-0000-000000000002', 'Closed School', 'closed-school', 'CLS-002', 'Closed Person', '9000000002', 'closed@example.invalid', '2 Private Road', false);

insert into public.services (slug, title, tagline, category, description, icon, enabled, display_order) values
  ('svc-b', 'Second Service', 'Label B', 'design-printing', 'Second service description text.', 'printer', true, 2),
  ('svc-a', 'First Service', 'Label A', 'id-cards', 'First service description text.', 'id-card', true, 1),
  ('svc-off', 'Disabled Service', 'Label C', 'id-cards', 'Disabled service description text.', 'users', false, 3);

insert into public.advertisements (title, description, icon, whatsapp_message, active, is_published, starts_at, ends_at) values
  ('Live ad', 'A live advertisement for tests.', 'diary', 'Live ad', true, true, null, null),
  ('Live in window', 'Inside its schedule window now.', 'diary', 'Window', true, true, now() - interval '1 day', now() + interval '1 day'),
  ('Draft ad', 'An unpublished advertisement draft.', 'diary', 'Draft', true, false, null, null),
  ('Disabled ad', 'A published but disabled advertisement.', 'diary', 'Disabled', false, true, null, null),
  ('Future ad', 'Starts tomorrow so it is hidden today.', 'diary', 'Future', true, true, now() + interval '1 day', null),
  ('Expired ad', 'Ended a second ago so it is hidden now.', 'diary', 'Expired', true, true, now() - interval '2 days', now() - interval '1 second');

insert into public.feedback (id, name, organization, rating, message, status, created_at) values
  ('f0000000-0000-0000-0000-000000000001', 'Approved Person', 'Some School', 5, 'Approved feedback message text.', 'approved', now() - interval '2 days'),
  ('f0000000-0000-0000-0000-000000000002', 'Newest Approved', null, 4, 'Another approved feedback message.', 'approved', now() - interval '1 day'),
  ('f0000000-0000-0000-0000-000000000003', 'Pending Person', null, 3, 'Pending feedback message text.', 'pending', now()),
  ('f0000000-0000-0000-0000-000000000004', 'Rejected Person', null, 1, 'Rejected feedback message text.', 'rejected', now());

set local role anon;
select set_config('request.jwt.claims', '', true);

-- Schools ------------------------------------------------------------------------------------------------------------------------
select is((select count(*) from public.list_active_schools())::int, 1, 'only the active school is listed publicly');
select is((select name from public.list_active_schools()), 'Active School', 'the listed school is the active one');
select is((select to_jsonb(s) ? 'phone' or to_jsonb(s) ? 'email' or to_jsonb(s) ? 'contact_person' or to_jsonb(s) ? 'address' from public.list_active_schools() s limit 1), false,
  'the public school list carries no contact details');
select is((select status from public.resolve_school('active-school')), 'active', 'an active school resolves');
select is((select name from public.resolve_school('active-school')), 'Active School', 'an active school resolves with its name');
select is((select name from public.resolve_school('  ACTIVE-School ')), 'Active School', 'slug lookup ignores case and surrounding spaces');
select is((select status from public.resolve_school('closed-school')), 'inactive', 'an inactive school reports only that it is inactive');
select is((select school_id is null and name is null and slug is null from public.resolve_school('closed-school')), true,
  'an inactive school reveals no id, name or slug');
select is((select status from public.resolve_school('nope-nothing')), 'not_found', 'an unknown slug reports not_found');
select is((select count(*) from public.resolve_school(null))::int, 1, 'a null slug still yields one not_found row, never an error');
select throws_ok($$select * from public.schools$$, '42501', null, 'the schools table cannot be read directly');
select throws_ok($$select phone from public.schools$$, '42501', null, 'school contact columns cannot be read directly');

-- Services -----------------------------------------------------------------------------------------------------------------------
select is((select array_agg(title order by display_order) from public.list_enabled_services()), array['First Service', 'Second Service'],
  'only enabled services are listed, in display order');
select is((select count(*) from public.list_enabled_services() where title = 'Disabled Service')::int, 0, 'a disabled service is never listed');
select throws_ok($$select * from public.services$$, '42501', null, 'the services table cannot be read directly');

-- Advertisements -----------------------------------------------------------------------------------------------------------------
select is((select array_agg(title order by title) from public.list_published_advertisements()), array['Live ad', 'Live in window'],
  'only enabled, published, started and not-yet-ended advertisements are listed');
select is((select count(*) from public.list_published_advertisements() where title in ('Draft ad', 'Disabled ad', 'Future ad', 'Expired ad'))::int, 0,
  'draft, disabled, future and expired advertisements are hidden');
select is((select to_jsonb(a) ? 'active' or to_jsonb(a) ? 'is_published' from public.list_published_advertisements() a limit 1), false,
  'public advertisement rows carry no internal flags');
select throws_ok($$select * from public.advertisements$$, '42501', null, 'the advertisements table cannot be read directly');

-- Feedback -----------------------------------------------------------------------------------------------------------------------
select is((select array_agg(name order by created_at desc) from public.list_approved_feedback()), array['Newest Approved', 'Approved Person'],
  'only approved feedback is listed, newest first');
select is((select count(*) from public.list_approved_feedback() where name in ('Pending Person', 'Rejected Person'))::int, 0, 'pending and rejected feedback are never listed');
select is((select count(*) from public.list_approved_feedback(1))::int, 1, 'the optional limit is honoured');
select is((select count(*) from public.list_approved_feedback(0))::int, 1, 'a limit below one is raised to one');
select is((select count(*) from public.list_approved_feedback(100000))::int, 2, 'an oversized limit is capped (never unbounded)');
select is((select count(*) from public.list_approved_feedback(null))::int, 2, 'a null limit uses the default');
select is((select to_jsonb(f) ? 'status' from public.list_approved_feedback() f limit 1), false, 'public feedback rows carry no moderation status');
select throws_ok($$select * from public.feedback$$, '42501', null, 'the feedback table cannot be read directly');
reset role;

-- Changes made by the administrator show up immediately through the same public functions ---------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.services set enabled = false where slug = 'svc-a'$$, 'admin disables a service');
select lives_ok($$update public.advertisements set is_published = false where title = 'Live ad'$$, 'admin unpublishes an advertisement');
select lives_ok($$update public.feedback set status = 'approved' where name = 'Pending Person'$$, 'admin approves feedback');
select lives_ok($$update public.schools set is_active = false where slug = 'active-school'$$, 'admin deactivates a school');
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select array_agg(title) from public.list_enabled_services()), array['Second Service'], 'the disabled service disappears from the public list at once');
select is((select array_agg(title) from public.list_published_advertisements()), array['Live in window'], 'the unpublished advertisement disappears at once');
select is((select count(*) from public.list_approved_feedback() where name = 'Pending Person')::int, 1, 'newly approved feedback appears at once');
select is((select count(*) from public.list_active_schools())::int, 0, 'a deactivated school disappears from the public list at once');
select is((select status from public.resolve_school('active-school')), 'inactive', 'and its link now reports inactive without details');
reset role;

-- Moving feedback back out of "approved" hides it again -------------------------------------------------------------------------
update public.feedback set status = 'pending' where name = 'Pending Person';
set local role anon;
select is((select count(*) from public.list_approved_feedback() where name = 'Pending Person')::int, 0, 'feedback returned to pending is hidden again');
reset role;

select * from finish();
rollback;
