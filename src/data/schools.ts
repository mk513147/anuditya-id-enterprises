import type { School } from '@/types'

/**
 * DEMO DATA. Every school, person, phone number and e-mail below is fictional
 * (example.com addresses, 9000000xxx numbers). Replace with real records via the admin panel / database.
 */
export const SCHOOLS_DATA: School[] = [
  { id: 'sch-stmarys', name: "St. Mary's School", slug: 'st-marys-school', code: 'STM-001', contactPerson: 'Demo Principal', phone: '9000000001', email: 'office@stmarys.example.com', address: '1 Sample Road, Demo Town', isActive: true, createdAt: '2026-06-02T09:30:00.000Z', updatedAt: '2026-06-02T09:30:00.000Z' },
  { id: 'sch-greenvalley', name: 'Green Valley College', slug: 'green-valley-college', code: 'GVC-002', contactPerson: 'Demo Registrar', phone: '9000000002', email: 'admin@greenvalley.example.com', address: '22 Example Avenue, Sample City', isActive: true, createdAt: '2026-06-18T11:00:00.000Z', updatedAt: '2026-06-18T11:00:00.000Z' },
  { id: 'sch-sunrise', name: 'Sunrise Public School', slug: 'sunrise-public-school', code: 'SPS-003', contactPerson: 'Demo Coordinator', phone: '9000000003', email: 'info@sunrise.example.com', address: '5 Placeholder Lane, Demo Nagar', isActive: true, createdAt: '2026-07-09T08:15:00.000Z', updatedAt: '2026-07-09T08:15:00.000Z' },
  { id: 'sch-model', name: 'Model Academy', slug: 'model-academy', code: 'MDA-004', contactPerson: 'Demo Administrator', phone: '9000000004', address: '9 Test Street, Sample Town', isActive: false, createdAt: '2026-07-27T14:20:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' },
  { id: 'sch-lotus', name: 'Lotus International School', slug: 'lotus-international-school', code: 'LIS-005', contactPerson: 'Demo Office Head', phone: '9000000005', email: 'hello@lotus.example.com', address: '14 Fictional Park, Demo City', isActive: true, createdAt: '2026-09-15T12:45:00.000Z', updatedAt: '2026-09-15T12:45:00.000Z' },
]
