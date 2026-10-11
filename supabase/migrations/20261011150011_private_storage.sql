-- Phase A / 11 of 11: private storage buckets and policies (bucket setup only; no upload flow is implemented in this phase).
--
-- Both buckets are PRIVATE. There is no anonymous policy of any kind, so an anonymous visitor can neither list, read
-- nor download an object. Only the signed-in administrator may read objects (which is what createSignedUrl needs).
-- There are deliberately NO insert/update/delete policies for client roles: objects are written by trusted server code
-- using the service role (Phase B), which also fixes the content type itself. Retention/deletion rules are an open
-- business decision (D-RET); until it is made, nothing is deletable by a client.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Student photographs (minors). Same limit as validations/student.ts (2 MB, JPG/PNG).
  ('student-photos', 'student-photos', false, 2097152, array['image/jpeg', 'image/png']),
  -- Uploaded spreadsheets (contain student data). Same limit as validations/upload.ts (10 MB).
  ('school-uploads', 'school-uploads', false, 10485760, array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel',                                          -- .xls (and some CSV reports)
    'text/csv', 'application/csv'                                        -- .csv
  ])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "administrator can read private objects" on storage.objects
  for select to authenticated
  using (bucket_id in ('student-photos', 'school-uploads') and private.is_admin());
