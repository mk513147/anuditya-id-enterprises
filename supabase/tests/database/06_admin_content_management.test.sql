-- Administrator content management (schools, services, advertisements, feedback) and public feedback submission.
begin;
select plan(42);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');

-- Public feedback submission (always pending) -------------------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select status from public.submit_feedback('Test Visitor', 'Test School', 5, 'A perfectly fine feedback message.')), 'pending', 'public feedback is always stored as pending');
select is((select count(*) from public.list_approved_feedback() where name = 'Test Visitor')::int, 0, 'and is not public until approved');
select is((select count(*) from public.submit_feedback('  Spaced Name  ', '   ', 4, '  Trimmed feedback message here.  '))::int, 1, 'optional organisation may be blank');
select throws_ok($$select * from public.submit_feedback('Test Visitor', null, 6, 'A perfectly fine feedback message.')$$, '22023', 'invalid_input', 'a rating above five is rejected');
select throws_ok($$select * from public.submit_feedback('Test Visitor', null, 0, 'A perfectly fine feedback message.')$$, '22023', 'invalid_input', 'a rating below one is rejected');
select throws_ok($$select * from public.submit_feedback('Test Visitor', null, null, 'A perfectly fine feedback message.')$$, '22023', 'invalid_input', 'a missing rating is rejected');
select throws_ok($$select * from public.submit_feedback('A', null, 5, 'A perfectly fine feedback message.')$$, '23514', null, 'a one-character name is rejected');
select throws_ok($$select * from public.submit_feedback('Test Visitor', null, 5, 'too short')$$, '23514', null, 'a message under ten characters is rejected');
select throws_ok($$select * from public.submit_feedback('Test Visitor', null, 5, repeat('x', 601))$$, '23514', null, 'a message over 600 characters is rejected');
select throws_ok($$insert into public.feedback (name, rating, message, status) values ('Direct', 5, 'Direct insert attempt here.', 'approved')$$, '42501', null, 'anon cannot insert feedback directly, so cannot choose "approved"');
reset role;
select is((select count(*) from public.feedback where status = 'pending')::int, 2, 'only the two valid submissions were stored, both pending');
select is((select name from public.feedback where message = 'Trimmed feedback message here.'), 'Spaced Name', 'text is trimmed on the way in');

-- Administrator: schools ----------------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.schools (name, slug, code, contact_person, phone, email) values ('Admin School', 'admin-school', 'ADM-001', 'Admin Person', '9000000021', 'a@example.invalid')$$, 'the administrator creates a school');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Other', 'other-school', 'adm-001', 'P', '9000000022')$$, '23514', null, 'a lower-case code is rejected by the format rule');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Other', 'other-school', 'ADM-001', 'Person', '9000000022')$$, '23505', null, 'a duplicate school code is rejected');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Other', 'admin-school', 'OTH-002', 'Person', '9000000022')$$, '23505', null, 'a duplicate link name (slug) is rejected');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Other', 'Other-School', 'OTH-002', 'Person', '9000000022')$$, '23514', null, 'a slug with capitals is rejected');
select throws_ok($$insert into public.schools (name, slug, code, contact_person, phone) values ('Other', 'other-school', 'OTH-002', 'Person', '123')$$, '23514', null, 'an invalid school phone number is rejected');

-- Administrator: services ------------------------------------------------------------------------------------------------------------------------------
select lives_ok($$insert into public.services (slug, title, tagline, category, description, icon) values ('first-service', 'First Service', 'Label', 'id-cards', 'A description that is long enough.', 'id-card')$$, 'the administrator adds a service (display order is filled in)');
select lives_ok($$insert into public.services (slug, title, tagline, category, description, icon, image_url) values ('second-service', 'Second Service', 'Label', 'design-printing', 'A description that is long enough.', 'printer', 'https://example.com/a.png')$$, 'a second service gets the next display order');
select is((select array_agg(display_order order by display_order) from public.services), array[1, 2], 'display order is max + 1 when omitted');
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon) values ('dup', '  FIRST   service ', 'Label', 'id-cards', 'A description that is long enough.', 'id-card')$$, '23505', null, 'a service name that differs only in case or spacing is rejected');
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon, image_url) values ('bad-image', 'Bad Image', 'Label', 'id-cards', 'A description that is long enough.', 'id-card', 'javascript:alert(1)')$$, '23514', null, 'a javascript: image link is rejected');
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon, image_url) values ('bad-image', 'Bad Image', 'Label', 'id-cards', 'A description that is long enough.', 'id-card', 'data:image/png;base64,AAAA')$$, '23514', null, 'a data: image link is rejected');
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon) values ('bad-icon', 'Bad Icon', 'Label', 'id-cards', 'A description that is long enough.', 'rocket')$$, '23514', null, 'an unknown icon is rejected');
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon) values ('bad-cat', 'Bad Category', 'Label', 'toys', 'A description that is long enough.', 'id-card')$$, '22P02', null, 'an unknown category is rejected');
select lives_ok($$update public.services set tagline = 'New Label', enabled = false where slug = 'first-service'$$, 'the administrator edits and disables a service');
select throws_ok($$update public.services set slug = 'changed' where slug = 'first-service'$$, '42501', null, 'the slug cannot be changed after creation');
select throws_ok($$delete from public.services$$, '42501', null, 'services cannot be deleted');

-- Administrator: advertisements ------------------------------------------------------------------------------------------------------------------------
select lives_ok($$insert into public.advertisements (title, description, icon, whatsapp_message, is_published, starts_at, ends_at)
  values ('Scheduled ad', 'An advertisement with a schedule.', 'diary', 'Scheduled', true, '2026-08-31T18:30:00Z', '2026-12-31T18:29:59Z')$$, 'the administrator creates a scheduled advertisement');
select throws_ok($$insert into public.advertisements (title, description, icon, whatsapp_message, starts_at, ends_at)
  values ('Bad schedule', 'An advertisement that ends before it starts.', 'diary', 'Bad', '2026-12-31T00:00:00Z', '2026-12-30T00:00:00Z')$$, '23514', null, 'an end before the start is rejected');
select throws_ok($$insert into public.advertisements (title, description, icon, whatsapp_message, image_url)
  values ('Bad image', 'An advertisement with an unsafe image link.', 'diary', 'Bad', 'javascript:alert(1)')$$, '23514', null, 'an unsafe advertisement image link is rejected');
select is((select is_published from public.advertisements where title = 'Scheduled ad'), true, 'the publication flag is stored');
select lives_ok($$insert into public.advertisements (title, description, icon, whatsapp_message) values ('Plain ad', 'An advertisement with defaults.', 'diary', 'Plain')$$, 'a new advertisement can be created with defaults');
select is((select is_published from public.advertisements where title = 'Plain ad'), false, 'new advertisements default to drafts');
select throws_ok($$delete from public.advertisements$$, '42501', null, 'advertisements cannot be deleted');

-- Administrator: feedback moderation -------------------------------------------------------------------------------------------------------------------
select lives_ok($$update public.feedback set status = 'approved' where name = 'Test Visitor'$$, 'the administrator approves feedback');
select throws_ok($$update public.feedback set message = 'Rewritten by the administrator.' where name = 'Test Visitor'$$, '42501', null, 'the text of feedback cannot be edited');
select throws_ok($$delete from public.feedback$$, '42501', null, 'feedback cannot be deleted');
reset role;

-- A signed-in user who is not the administrator cannot manage content -------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.services (slug, title, tagline, category, description, icon) values ('x-svc', 'Not Allowed', 'Label', 'id-cards', 'A description that is long enough.', 'id-card')$$, '42501', null, 'a non-administrator cannot add services (RLS)');
select is((select count(*) from public.feedback)::int, 0, 'a non-administrator cannot see feedback');
with u as (update public.advertisements set is_published = true returning 1) select is((select count(*) from u)::int, 0, 'a non-administrator updates nothing (RLS hides every row)');
reset role;

select * from finish();
rollback;
