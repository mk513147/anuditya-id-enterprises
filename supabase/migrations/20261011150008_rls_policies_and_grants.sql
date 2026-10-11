-- Phase A / 8 of 11: Row Level Security policies and table privileges.
--
-- Model: anonymous users get NO table privileges and NO policies. Everything public goes through the functions in
-- 0009/0010. The single administrator (see private.is_admin()) gets exactly the access the admin screens need:
-- column-level grants whitelist the editable columns, and RLS restricts every row to the administrator.
-- There is NO DELETE privilege anywhere: the application never deletes (it archives, disables or unpublishes).
-- service_role bypasses RLS and is for trusted server code only; it must never appear in frontend code.

-- Every table has RLS enabled (asserted by supabase/tests/database/00_security_baseline.test.sql).

-- ------------------------------------------------------------------ profiles: a user may read only their own row
grant select (id, role, created_at, updated_at) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
-- No insert/update/delete privilege and no policy: nobody can assign or change a role through the API.

-- ------------------------------------------------------------------ schools: full admin management, no delete
grant select on public.schools to authenticated;
grant insert (name, slug, code, contact_person, phone, email, address) on public.schools to authenticated;
grant update (name, slug, code, contact_person, phone, email, address, is_active) on public.schools to authenticated;
create policy schools_admin_select on public.schools for select to authenticated using (private.is_admin());
create policy schools_admin_insert on public.schools for insert to authenticated with check (private.is_admin());
create policy schools_admin_update on public.schools for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ------------------------------------------------------------------ students: read and edit by admin only
-- No INSERT privilege at all: submissions are created only by public.submit_student(), which forces 'pending'.
-- Approval status and review time can only change through public.admin_review_student(); reference number, school and
-- submission time are immutable (trigger) and not even granted for update.
grant select on public.students to authenticated;
grant update (
  name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile,
  blood_group, house_name, house_colour, bus_route, bus_stoppage, archived_at
) on public.students to authenticated;
create policy students_admin_select on public.students for select to authenticated using (private.is_admin());
create policy students_admin_update on public.students for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ------------------------------------------------------------------ orders: read by admin only; changes via functions
-- tracking_secret_hash is deliberately NOT granted: not even the administrator's client can read it.
-- (A client must therefore list columns explicitly instead of select('*').)
grant select (
  id, order_no, school_id, customer_name, service, quantity, status, order_date, expected_delivery,
  internal_notes, created_at, updated_at
) on public.orders to authenticated;
create policy orders_admin_select on public.orders for select to authenticated using (private.is_admin());

grant select on public.order_status_history to authenticated;
create policy order_status_history_admin_select on public.order_status_history for select to authenticated using (private.is_admin());

-- ------------------------------------------------------------------ uploaded files: metadata readable by admin only
grant select on public.uploaded_files to authenticated;
create policy uploaded_files_admin_select on public.uploaded_files for select to authenticated using (private.is_admin());

-- ------------------------------------------------------------------ services
grant select on public.services to authenticated;
grant insert (slug, title, tagline, category, description, image_url, icon, enabled, display_order) on public.services to authenticated;
grant update (title, tagline, category, description, image_url, icon, enabled) on public.services to authenticated;
create policy services_admin_select on public.services for select to authenticated using (private.is_admin());
create policy services_admin_insert on public.services for insert to authenticated with check (private.is_admin());
create policy services_admin_update on public.services for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ------------------------------------------------------------------ advertisements
grant select on public.advertisements to authenticated;
grant insert (title, description, offer, image_url, icon, whatsapp_message, active, is_published, starts_at, ends_at, featured)
  on public.advertisements to authenticated;
grant update (title, description, offer, image_url, icon, whatsapp_message, active, is_published, starts_at, ends_at, featured)
  on public.advertisements to authenticated;
create policy advertisements_admin_select on public.advertisements for select to authenticated using (private.is_admin());
create policy advertisements_admin_insert on public.advertisements for insert to authenticated with check (private.is_admin());
create policy advertisements_admin_update on public.advertisements for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ------------------------------------------------------------------ feedback: moderation by admin only
-- No INSERT privilege: submissions go through public.submit_feedback(), which forces 'pending'.
grant select on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
create policy feedback_admin_select on public.feedback for select to authenticated using (private.is_admin());
create policy feedback_admin_update on public.feedback for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
