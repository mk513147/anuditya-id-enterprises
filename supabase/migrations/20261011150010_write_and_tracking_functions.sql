-- Phase A / 10 of 11: public write operations, administrator operations and order tracking.
--
-- Errors are raised with a short machine-readable MESSAGE the repository adapter maps to RepositoryError codes:
--   school_unavailable, not_authorized, not_found, no_change, invalid_input.
-- CHECK-constraint failures surface as SQLSTATE 23514 with the constraint name, unique violations as 23505.
--
-- ABUSE NOTE: the two anonymous write functions have no rate limit or CAPTCHA at this layer (the API gateway does not
-- provide per-IP limits for RPC). Phase B must put them behind a server function with bot protection and then REVOKE
-- the direct anon grant. See docs/supabase/security.md.

-- ------------------------------------------------------------------ student submission (public, always pending)
create function public.submit_student(
  p_school_id uuid,
  p_name text,
  p_father_name text,
  p_mother_name text,
  p_dob date,
  p_class_name text,
  p_section text,
  p_roll_no text,
  p_admission_no text,
  p_address text,
  p_mobile text,
  p_blood_group text default null,
  p_house_name text default null,
  p_house_colour text default null,
  p_bus_route text default null,
  p_bus_stoppage text default null,
  p_photo_path text default null
)
returns table (reference_no text, submitted_at timestamptz, school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_name text;
  v_active boolean;
  v_ref text;
  v_at timestamptz;
begin
  -- The school is re-checked here, never trusted from the browser. Unknown and inactive look identical.
  select s.name, s.is_active into v_school_name, v_active from public.schools s where s.id = p_school_id;
  if v_school_name is null or not v_active then
    raise exception 'school_unavailable' using errcode = 'P0001';
  end if;

  -- The approval status is NOT a parameter: whatever the browser sends, a new submission is pending.
  insert into public.students (
    school_id, name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile,
    blood_group, house_name, house_colour, bus_route, bus_stoppage, photo_path, approval_status, reviewed_at
  ) values (
    p_school_id, btrim(p_name), btrim(p_father_name), btrim(p_mother_name), p_dob, btrim(p_class_name), upper(btrim(p_section)),
    btrim(p_roll_no), btrim(p_admission_no), btrim(p_address), btrim(p_mobile),
    nullif(btrim(p_blood_group), ''), nullif(btrim(p_house_name), ''), nullif(btrim(p_house_colour), ''),
    nullif(btrim(p_bus_route), ''), nullif(btrim(p_bus_stoppage), ''), nullif(btrim(p_photo_path), ''),
    'pending', null
  )
  returning students.reference_no, students.submitted_at into v_ref, v_at;

  return query select v_ref, v_at, v_school_name;
end;
$$;

-- ------------------------------------------------------------------ feedback submission (public, always pending)
create function public.submit_feedback(p_name text, p_organization text, p_rating integer, p_message text)
returns table (id uuid, status public.feedback_status)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'rating must be 1 to 5';
  end if;
  return query
    insert into public.feedback as f (name, organization, rating, message, status)
    values (btrim(p_name), nullif(btrim(p_organization), ''), p_rating::smallint, btrim(p_message), 'pending')
    returning f.id, f.status;
end;
$$;

-- ------------------------------------------------------------------ administrator: approve / reject a student submission
create function public.admin_review_student(p_student_id uuid, p_decision public.student_approval_status)
returns table (id uuid, approval_status public.student_approval_status, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.student_approval_status;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select s.approval_status into v_current from public.students s where s.id = p_student_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current = p_decision then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  -- Any decision may follow any other (a decision can be reversed). Rejected rows are kept, never deleted. See D-REJ.
  return query
    update public.students s
    set approval_status = p_decision,
        reviewed_at = case when p_decision = 'pending' then null else now() end
    where s.id = p_student_id
    returning s.id, s.approval_status, s.reviewed_at;
end;
$$;

-- ------------------------------------------------------------------ tracking codes
-- 25 characters from a 32-letter alphabet without look-alikes (no I, O, 0, 1): 125 bits of entropy, drawn from the
-- database's cryptographic RNG. Each character uses (byte & 31): 256 is a multiple of 32, so there is no modulo bias.
create function private.generate_tracking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(25);
  v_code text := '';
  i integer;
begin
  for i in 0..24 loop
    v_code := v_code || substr(c_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
    if i in (4, 9, 14, 19) then v_code := v_code || '-'; end if;
  end loop;
  return v_code;
end;
$$;
revoke all on function private.generate_tracking_code() from public;

-- Canonical form used for hashing and comparing: letters and digits only, upper-case.
create function private.normalize_tracking_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;
revoke all on function private.normalize_tracking_code(text) from public;

-- Same rules as src/lib/orderReference.ts: trim, whitespace runs become one hyphen, strip edge hyphens, upper-case.
create function private.normalize_order_no(p_order_no text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(regexp_replace(btrim(coalesce(p_order_no, '')), '\s+', '-', 'g'), '^-+|-+$', '', 'g'))
$$;
revoke all on function private.normalize_order_no(text) from public;

-- The stored value binds the secret to its own order, so two orders can never share a hash. Only the hash is stored.
create function private.tracking_hash(p_order_id uuid, p_normalized_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(convert_to(p_order_id::text || ':' || p_normalized_code, 'UTF8'), 'sha256')
$$;
revoke all on function private.tracking_hash(uuid, text) from public;

-- ------------------------------------------------------------------ administrator: create an order and issue its code
-- Returns the plaintext tracking code EXACTLY ONCE. It cannot be read back later (only a hash is stored); if the
-- customer loses it, use admin_rotate_tracking_code, which invalidates the old code.
create function public.admin_create_order(
  p_school_id uuid,
  p_customer_name text,
  p_service text,
  p_quantity integer,
  p_order_date date,
  p_expected_delivery date,
  p_internal_notes text default null
)
returns table (order_id uuid, order_no text, tracking_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text := private.generate_tracking_code();
  v_customer text;
  v_no text;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_customer := nullif(btrim(p_customer_name), '');
  if p_school_id is not null then
    select s.name into v_customer from public.schools s where s.id = p_school_id;
    if v_customer is null then
      raise exception 'not_found' using errcode = 'P0002', detail = 'school';
    end if;
  end if;
  insert into public.orders as o (
    id, school_id, customer_name, service, quantity, order_date, expected_delivery, internal_notes, tracking_secret_hash
  ) values (
    v_id, p_school_id, v_customer, btrim(p_service), p_quantity, p_order_date, p_expected_delivery,
    nullif(btrim(p_internal_notes), ''), private.tracking_hash(v_id, private.normalize_tracking_code(v_code))
  )
  returning o.order_no into v_no;
  return query select v_id, v_no, v_code;
end;
$$;

-- Issues a NEW tracking code for an order and invalidates the previous one. Returned once, never stored in plaintext.
create function public.admin_rotate_tracking_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := private.generate_tracking_code();
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.orders set tracking_secret_hash = private.tracking_hash(id, private.normalize_tracking_code(v_code))
  where id = p_order_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_code;
end;
$$;

-- ------------------------------------------------------------------ administrator: change an order's status
-- Any supported status may be chosen (the app lets the admin correct mistakes); nothing advances automatically.
-- The history row is written by a trigger in the same transaction.
create function public.admin_set_order_status(p_order_id uuid, p_status public.order_status)
returns table (order_id uuid, status public.order_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.order_status;
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select o.status into v_current from public.orders o where o.id = p_order_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current = p_status then
    raise exception 'no_change' using errcode = 'P0001';
  end if;
  return query
    update public.orders o set status = p_status where o.id = p_order_id
    returning o.id, o.status, o.updated_at;
end;
$$;

-- ------------------------------------------------------------------ public order tracking
-- Requires BOTH the order number and the separate secret tracking code. The result for "no such order", "wrong code",
-- "malformed code" and "order without a code" is identical (zero rows), so nothing can be learned about which
-- order numbers exist, and the hash is computed in every case so response time does not reveal that either.
-- Returns the same whitelist as today's public lookup: never internal notes, ids, history or the hash.
create function public.track_order(p_order_no text, p_tracking_code text)
returns table (
  order_no text, customer_name text, service text, quantity integer,
  status public.order_status, order_date date, expected_delivery date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_no text := private.normalize_order_no(p_order_no);
  v_code text := private.normalize_tracking_code(p_tracking_code);
  v_wellformed boolean := v_no ~ '^[A-Z0-9][A-Z0-9-]{4,29}$' and v_code ~ '^[A-Z2-9]{25}$';
  v_order public.orders%rowtype;
  v_expected bytea;
begin
  select * into v_order from public.orders o where o.order_no = v_no;
  v_expected := private.tracking_hash(coalesce(v_order.id, '00000000-0000-0000-0000-000000000000'::uuid), v_code);
  if v_wellformed
     and v_order.id is not null
     and v_order.tracking_secret_hash is not null
     and v_order.tracking_secret_hash = v_expected then
    return query select v_order.order_no, v_order.customer_name, v_order.service, v_order.quantity,
                        v_order.status, v_order.order_date, v_order.expected_delivery;
  end if;
end;
$$;

-- ------------------------------------------------------------------ privileges
revoke all on function public.submit_student(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.submit_feedback(text, text, integer, text) from public;
revoke all on function public.admin_review_student(uuid, public.student_approval_status) from public;
revoke all on function public.admin_create_order(uuid, text, text, integer, date, date, text) from public;
revoke all on function public.admin_rotate_tracking_code(uuid) from public;
revoke all on function public.admin_set_order_status(uuid, public.order_status) from public;
revoke all on function public.track_order(text, text) from public;

grant execute on function public.submit_student(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.submit_feedback(text, text, integer, text) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- Administrator functions: signed-in users only (anonymous cannot even call them), and each one re-checks is_admin().
grant execute on function public.admin_review_student(uuid, public.student_approval_status) to authenticated;
grant execute on function public.admin_create_order(uuid, text, text, integer, date, date, text) to authenticated;
grant execute on function public.admin_rotate_tracking_code(uuid) to authenticated;
grant execute on function public.admin_set_order_status(uuid, public.order_status) to authenticated;

-- Helper functions used by the functions above run as the function owner (SECURITY DEFINER); they are not granted to clients.
grant execute on function private.generate_tracking_code() to service_role;
grant execute on function private.normalize_tracking_code(text) to service_role;
grant execute on function private.normalize_order_no(text) to service_role;
grant execute on function private.tracking_hash(uuid, text) to service_role;
