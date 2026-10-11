-- DEVELOPMENT SEED ONLY. Loaded by `supabase db reset` against the LOCAL database (see config.toml [db.seed]).
-- It must never be run against a hosted project, and contains no real data:
--   * services: the public catalogue from src/data/services.ts (placeholder descriptions; no student data);
--   * schools: the fictional demo schools from src/data/schools.ts (example.com addresses, 9000000xxx numbers).
-- No students, orders, files, feedback, credentials or tracking codes are seeded.

insert into public.services (slug, title, tagline, category, description, icon, enabled, display_order) values
  ('student-id-card', 'Student ID Card', 'Student & Staff', 'id-cards', 'Durable PVC ID cards with photo, name and class details for every student.', 'id-card', true, 1),
  ('staff-id-card', 'Staff ID Card', 'Office & Staff', 'id-cards', 'Professional staff identity cards for teachers, admin and support teams.', 'users', true, 2),
  ('school-id-card', 'School ID Card', 'School & College', 'id-cards', 'Complete school ID card sets with your logo, colours and layout.', 'school', true, 3),
  ('college-id-card', 'College ID Card', 'College & University', 'id-cards', 'ID cards for colleges and institutes, including course and session details.', 'graduation', true, 4),
  ('premium-lanyard-ribbon', 'Premium Lanyard / Ribbon', 'Premium Quality', 'id-cards', 'Printed lanyards and ribbons in your institution colours, with strong clips.', 'ribbon', true, 5),
  ('school-diary', 'School Diary', 'Custom Design', 'school-materials', 'Custom school diaries with calendar, rules and your own cover design.', 'diary', true, 6),
  ('magazine', 'Magazine', 'School / College', 'school-materials', 'Annual magazines designed and printed with a clean, professional finish.', 'magazine', true, 7),
  ('prospectus', 'Prospectus', 'All Design', 'school-materials', 'Admission prospectus and brochures that present your institution well.', 'prospectus', true, 8),
  ('group-photo', 'Group Photo', 'College / School', 'school-materials', 'Class and event group photos, printed in sharp, framed-ready sizes.', 'camera', true, 9),
  ('logo-design', 'Logo Design', 'Modern & Creative', 'design-printing', 'A clear, memorable logo for your school, college or business.', 'pen-tool', true, 10),
  ('banner-design', 'Banner Design', 'Attractive Design', 'design-printing', 'Flex banners and hoardings designed for events and admissions.', 'banner', true, 11),
  ('printing-services', 'Printing Services', 'All Type Printing', 'design-printing', 'Forms, certificates, receipts and other day-to-day printing needs.', 'printer', true, 12)
on conflict (slug) do nothing;

insert into public.schools (name, slug, code, contact_person, phone, email, address, is_active) values
  ('St. Mary''s School', 'st-marys-school', 'STM-001', 'Demo Principal', '9000000001', 'office@stmarys.example.com', '1 Sample Road, Demo Town', true),
  ('Green Valley College', 'green-valley-college', 'GVC-002', 'Demo Registrar', '9000000002', 'admin@greenvalley.example.com', '22 Example Avenue, Sample City', true),
  ('Sunrise Public School', 'sunrise-public-school', 'SPS-003', 'Demo Coordinator', '9000000003', 'info@sunrise.example.com', '5 Placeholder Lane, Demo Nagar', true),
  ('Model Academy', 'model-academy', 'MDA-004', 'Demo Administrator', '9000000004', null, '9 Test Street, Sample Town', false),
  ('Lotus International School', 'lotus-international-school', 'LIS-005', 'Demo Office Head', '9000000005', 'hello@lotus.example.com', '14 Fictional Park, Demo City', true)
on conflict do nothing;
