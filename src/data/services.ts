import type { Service } from '@/types'

/** Mock service catalogue. Replace `image` with real product photography when available. */
export const SERVICES_DATA: Service[] = [
  { id: 'svc-student-id', slug: 'student-id-card', category: 'id-cards', title: 'Student ID Card', tagline: 'Student & Staff', description: 'Durable PVC ID cards with photo, name and class details for every student.', icon: 'id-card', enabled: true, order: 1 },
  { id: 'svc-staff-id', slug: 'staff-id-card', category: 'id-cards', title: 'Staff ID Card', tagline: 'Office & Staff', description: 'Professional staff identity cards for teachers, admin and support teams.', icon: 'users', enabled: true, order: 2 },
  { id: 'svc-school-id', slug: 'school-id-card', category: 'id-cards', title: 'School ID Card', tagline: 'School & College', description: 'Complete school ID card sets with your logo, colours and layout.', icon: 'school', enabled: true, order: 3 },
  { id: 'svc-college-id', slug: 'college-id-card', category: 'id-cards', title: 'College ID Card', tagline: 'College & University', description: 'ID cards for colleges and institutes, including course and session details.', icon: 'graduation', enabled: true, order: 4 },
  { id: 'svc-lanyard', slug: 'premium-lanyard-ribbon', category: 'id-cards', title: 'Premium Lanyard / Ribbon', tagline: 'Premium Quality', description: 'Printed lanyards and ribbons in your institution colours, with strong clips.', icon: 'ribbon', enabled: true, order: 5 },
  { id: 'svc-diary', slug: 'school-diary', category: 'school-materials', title: 'School Diary', tagline: 'Custom Design', description: 'Custom school diaries with calendar, rules and your own cover design.', icon: 'diary', enabled: true, order: 6 },
  { id: 'svc-magazine', slug: 'magazine', category: 'school-materials', title: 'Magazine', tagline: 'School / College', description: 'Annual magazines designed and printed with a clean, professional finish.', icon: 'magazine', enabled: true, order: 7 },
  { id: 'svc-prospectus', slug: 'prospectus', category: 'school-materials', title: 'Prospectus', tagline: 'All Design', description: 'Admission prospectus and brochures that present your institution well.', icon: 'prospectus', enabled: true, order: 8 },
  { id: 'svc-group-photo', slug: 'group-photo', category: 'school-materials', title: 'Group Photo', tagline: 'College / School', description: 'Class and event group photos, printed in sharp, framed-ready sizes.', icon: 'camera', enabled: true, order: 9 },
  { id: 'svc-logo', slug: 'logo-design', category: 'design-printing', title: 'Logo Design', tagline: 'Modern & Creative', description: 'A clear, memorable logo for your school, college or business.', icon: 'pen-tool', enabled: true, order: 10 },
  { id: 'svc-banner', slug: 'banner-design', category: 'design-printing', title: 'Banner Design', tagline: 'Attractive Design', description: 'Flex banners and hoardings designed for events and admissions.', icon: 'banner', enabled: true, order: 11 },
  { id: 'svc-printing', slug: 'printing-services', category: 'design-printing', title: 'Printing Services', tagline: 'All Type Printing', description: 'Forms, certificates, receipts and other day-to-day printing needs.', icon: 'printer', enabled: true, order: 12 },
]
