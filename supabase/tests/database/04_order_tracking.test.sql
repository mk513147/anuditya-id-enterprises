-- Public order tracking needs the order number AND a separate secret tracking code; only a hash of the code is stored.
begin;
select plan(52);

-- Fixtures (fictional) --------------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@example.invalid');
select private.provision_administrator('a0000000-0000-0000-0000-000000000001');
insert into public.schools (id, name, slug, code, contact_person, phone) values
  ('d0000000-0000-0000-0000-000000000001', 'Tracking School', 'tracking-school', 'TRK-001', 'Test Person', '9000000001');

-- The administrator creates two orders; each plaintext code is returned once and kept here only for the test.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.no1', o.order_no, true), set_config('test.code1', o.tracking_code, true), set_config('test.id1', o.order_id::text, true)
  from public.admin_create_order('d0000000-0000-0000-0000-000000000001', null, 'Student ID Card', 500, date '2026-10-01', date '2026-10-20', 'INTERNAL NOTE: courier pending') o;
select set_config('test.no2', o.order_no, true), set_config('test.code2', o.tracking_code, true), set_config('test.id2', o.order_id::text, true)
  from public.admin_create_order(null, 'Walk-in Customer', 'School Diary', 100, date '2026-10-02', date '2026-10-25', null) o;
reset role;

-- What was issued -------------------------------------------------------------------------------------------------------------------------
select is(current_setting('test.no1') ~ '^JOB-[0-9]{4}-[0-9]{4}$', true, 'order numbers use the JOB-YYYY-NNNN format');
select isnt(current_setting('test.no1'), current_setting('test.no2'), 'order numbers are unique');
select is(current_setting('test.code1') ~ '^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){4}$', true, 'the tracking code is 25 unambiguous characters (125 bits) in five groups');
select isnt(current_setting('test.code1'), current_setting('test.code2'), 'every order gets a different code');
select is((select customer_name from public.orders where order_no = current_setting('test.no1')), 'Tracking School', 'the customer name defaults to the school name');
select is((select customer_name from public.orders where order_no = current_setting('test.no2')), 'Walk-in Customer', 'an order without a school keeps the supplied customer name');

-- Only a hash is stored ------------------------------------------------------------------------------------------------------------------------
select is((select octet_length(tracking_secret_hash) from public.orders where order_no = current_setting('test.no1')), 32, 'a 32-byte SHA-256 hash is stored');
select is((select count(*) from public.orders o where o::text ilike '%' || current_setting('test.code1') || '%'
                                                   or o::text ilike '%' || replace(current_setting('test.code1'), '-', '') || '%')::int, 0,
  'the plaintext code (with or without dashes) appears nowhere in the stored row');
select is((select count(*) from public.orders where tracking_secret_hash = (select tracking_secret_hash from public.orders where order_no = current_setting('test.no2')))::int, 1,
  'two orders never share a hash');

-- Anonymous tracking -----------------------------------------------------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code1')))::int, 1, 'the correct order number and code find the order');
select is((select service || '/' || quantity || '/' || status from public.track_order(current_setting('test.no1'), current_setting('test.code1'))), 'Student ID Card/500/Order Received',
  'the tracked order shows its service, quantity and status');
select is((select customer_name from public.track_order(current_setting('test.no1'), current_setting('test.code1'))), 'Tracking School', 'and the customer name');
select is((select count(*) from public.track_order(lower(replace(current_setting('test.no1'), '-', ' ')), lower(replace(current_setting('test.code1'), '-', ' '))))::int, 1,
  'order number and code are tolerant of case, spaces and dashes (same normalisation as today)');
select is((select count(*) from public.track_order('  ' || current_setting('test.no1') || '  ', replace(current_setting('test.code1'), '-', '')))::int, 1, 'surrounding spaces and missing dashes are tolerated');
select is((select to_jsonb(t) ?| array['id', 'internal_notes', 'tracking_secret_hash', 'school_id', 'updated_at', 'statusHistory'] from public.track_order(current_setting('test.no1'), current_setting('test.code1')) t),
  false, 'the result never carries internal notes, ids, the hash or history');
select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code1')) t where t::text like '%INTERNAL NOTE%')::int, 0, 'the internal note is never returned');

-- Everything that must NOT work (all return zero rows, never an error, never a hint) -------------------------------------------------------------
select is((select count(*) from public.track_order(current_setting('test.no1'), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA'))::int, 0, 'a wrong code finds nothing');
select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code2')))::int, 0, 'the code of a DIFFERENT order does not unlock this one');
select is((select count(*) from public.track_order(current_setting('test.no2'), current_setting('test.code1')))::int, 0, 'and vice versa');
select is((select count(*) from public.track_order(current_setting('test.no1'), ''))::int, 0, 'an empty code finds nothing');
select is((select count(*) from public.track_order(current_setting('test.no1'), null))::int, 0, 'a missing code finds nothing');
select is((select count(*) from public.track_order(null, current_setting('test.code1')))::int, 0, 'a missing order number finds nothing');
select is((select count(*) from public.track_order(current_setting('test.no1'), substr(current_setting('test.code1'), 1, 10)))::int, 0, 'a partial code finds nothing');
select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code1') || 'A'))::int, 0, 'a code with extra characters finds nothing');
select is((select count(*) from public.track_order(substr(current_setting('test.no1'), 1, 9), current_setting('test.code1')))::int, 0, 'a partial order number finds nothing (exact match only)');
select is((select count(*) from public.track_order('JOB-2026-9999', current_setting('test.code1')))::int, 0, 'a non-existent order number finds nothing');
select is((select count(*) from public.track_order(current_setting('test.no1') || ' OR 1=1', current_setting('test.code1') || ''' OR ''1''=''1'))::int, 0, 'injection-style input finds nothing');
select is((select count(*) from public.track_order('%', '%'))::int, 0, 'wildcards find nothing');
select is((select count(*) from public.track_order('JOB-FAIL', current_setting('test.code1')))::int, 0, 'there is no special "JOB-FAIL" test hook in the database');
select throws_ok($$select * from public.orders$$, '42501', null, 'anon cannot read orders directly');
select throws_ok($$select * from public.order_status_history$$, '42501', null, 'anon cannot read status history');
select throws_ok($$select tracking_secret_hash from public.orders$$, '42501', null, 'anon cannot read the stored hash');
reset role;

-- An order with no tracking code can never be tracked -----------------------------------------------------------------------------------------------
insert into public.orders (order_no, customer_name, service, quantity, order_date, expected_delivery)
  values ('JOB-2026-9001', 'Legacy Customer', 'Magazine', 50, date '2026-09-01', date '2026-09-30');
set local role anon;
select is((select count(*) from public.track_order('JOB-2026-9001', current_setting('test.code1')))::int, 0, 'an order with no code issued cannot be tracked with any code');
select is((select count(*) from public.track_order('JOB-2026-9001', ''))::int, 0, 'nor with an empty code');
reset role;

-- Status changes: atomic history, visible to the customer ------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select status from public.admin_set_order_status(current_setting('test.id1')::uuid, 'Printing')), 'Printing', 'the administrator moves an order forward (stages may be skipped)');
select is((select status from public.admin_set_order_status(current_setting('test.id1')::uuid, 'Designing')), 'Designing', 'or back, to correct a mistake');
select throws_ok($$select * from public.admin_set_order_status(current_setting('test.id1')::uuid, 'Designing')$$, 'P0001', 'no_change', 'setting the same status is reported');
select throws_ok($$select * from public.admin_set_order_status('99999999-9999-9999-9999-999999999999', 'Ready')$$, 'P0002', 'not_found', 'a missing order is reported');
select throws_ok($$update public.orders set status = 'Delivered' where id = current_setting('test.id1')::uuid$$, '42501', null, 'status cannot be updated directly (only through the function)');
select is((select array_agg(status order by id) from public.order_status_history where order_id = current_setting('test.id1')::uuid), array['Printing', 'Designing']::public.order_status[],
  'every change was recorded in history, in order (the initial status is not logged)');
select throws_ok($$select tracking_secret_hash from public.orders$$, '42501', null, 'even the administrator cannot read the stored hash');
select throws_ok($$select * from public.orders$$, '42501', null, 'select * fails because it would include the hash; clients must list columns');
select is((select internal_notes from public.orders where id = current_setting('test.id1')::uuid), 'INTERNAL NOTE: courier pending', 'the administrator can read internal notes (listing columns)');
reset role;
set local role anon;
select is((select status from public.track_order(current_setting('test.no1'), current_setting('test.code1'))), 'Designing', 'tracking shows the administrator''s latest status immediately');
reset role;

-- Rotating the code invalidates the old one -------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.code1b', public.admin_rotate_tracking_code(current_setting('test.id1')::uuid), true);
reset role;
select isnt(current_setting('test.code1b'), current_setting('test.code1'), 'a rotated code is different');
set local role anon;
select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code1')))::int, 0, 'the old code stops working');
select is((select count(*) from public.track_order(current_setting('test.no1'), current_setting('test.code1b')))::int, 1, 'the new code works');
reset role;

-- Other roles cannot issue or rotate codes or create orders --------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.admin_rotate_tracking_code(current_setting('test.id1')::uuid)$$, '42501', 'not_authorized', 'a non-administrator cannot rotate a code');
select throws_ok($$select * from public.admin_set_order_status(current_setting('test.id1')::uuid, 'Delivered')$$, '42501', 'not_authorized', 'a non-administrator cannot change a status');
select is((select count(*) from public.orders)::int, 0, 'a non-administrator sees no orders');
reset role;

-- Renaming a school keeps the customer name on its orders in step ---------------------------------------------------------------------------------------
update public.schools set name = 'Renamed Tracking School' where id = 'd0000000-0000-0000-0000-000000000001';
set local role anon;
select is((select customer_name from public.track_order(current_setting('test.no1'), current_setting('test.code1b'))), 'Renamed Tracking School', 'the tracked customer name follows a school rename');
reset role;

select throws_ok($$update public.orders set order_no = 'JOB-2026-0000' where order_no = current_setting('test.no1')$$, '42501', null, 'an order number can never change');

select * from finish();
rollback;
