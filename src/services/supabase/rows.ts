import type { Advertisement, Feedback, FileCategory, FileReviewStatus, FileStorageState, Order, OrderStatus, School, Service, ServiceCategory, Student, StudentApprovalStatus, UploadedFileType } from '@/types'
import { opt } from './shared'

/**
 * Explicit column lists and row → domain mapping. Every select names its columns: `select('*')` is never used (it would
 * also fail on orders, whose tracking hash is deliberately not granted to any client role).
 */

// ------------------------------------------------------------------ schools
export const SCHOOL_COLUMNS = 'id, name, slug, code, contact_person, phone, email, address, is_active, created_at, updated_at'
export interface SchoolRow {
  id: string
  name: string
  slug: string
  code: string
  contact_person: string
  phone: string
  email: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
export const toSchool = (r: SchoolRow): School => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  code: r.code,
  contactPerson: r.contact_person,
  phone: r.phone,
  email: opt(r.email),
  address: opt(r.address),
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// ------------------------------------------------------------------ students
/** List columns: no photo path (photos are only fetched, as a short-lived link, on the detail page). */
export const STUDENT_COLUMNS =
  'id, reference_no, school_id, name, father_name, mother_name, dob, class_name, section, roll_no, admission_no, address, mobile, ' +
  'blood_group, house_name, house_colour, bus_route, bus_stoppage, submitted_at, updated_at, archived_at, approval_status, reviewed_at'
export const STUDENT_WITH_SCHOOL = `${STUDENT_COLUMNS}, school:schools(name, code, is_active)`
export interface StudentRow {
  id: string
  reference_no: string
  school_id: string
  name: string
  father_name: string
  mother_name: string
  dob: string
  class_name: string
  section: string
  roll_no: string
  admission_no: string
  address: string
  mobile: string
  blood_group: string | null
  house_name: string | null
  house_colour: string | null
  bus_route: string | null
  bus_stoppage: string | null
  submitted_at: string
  updated_at: string
  archived_at: string | null
  approval_status: StudentApprovalStatus
  reviewed_at: string | null
  school?: { name: string; code: string; is_active: boolean } | null
}
export const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  referenceNo: r.reference_no,
  schoolId: r.school_id,
  name: r.name,
  fatherName: r.father_name,
  motherName: r.mother_name,
  dob: r.dob,
  className: r.class_name,
  section: r.section,
  rollNo: r.roll_no,
  admissionNo: r.admission_no,
  address: r.address,
  mobile: r.mobile,
  bloodGroup: opt(r.blood_group),
  houseName: opt(r.house_name),
  houseColour: opt(r.house_colour),
  busRoute: opt(r.bus_route),
  busStoppage: opt(r.bus_stoppage),
  submittedAt: r.submitted_at,
  updatedAt: r.updated_at,
  isArchived: r.archived_at !== null,
  archivedAt: opt(r.archived_at),
  approvalStatus: r.approval_status,
  reviewedAt: opt(r.reviewed_at),
})
export const toAdminStudent = (r: StudentRow) => ({
  ...toStudent(r),
  schoolName: r.school?.name ?? 'Unknown school',
  schoolCode: r.school?.code ?? '-',
  schoolActive: r.school?.is_active ?? false,
})

// ------------------------------------------------------------------ orders
/** Never includes tracking_secret_hash (not granted, and never needed by the client). */
export const ORDER_COLUMNS = 'id, order_no, school_id, customer_name, service, quantity, status, order_date, expected_delivery, internal_notes, updated_at'
export const ORDER_WITH_SCHOOL = `${ORDER_COLUMNS}, school:schools(name, code)`
export interface OrderRow {
  id: string
  order_no: string
  school_id: string | null
  customer_name: string
  service: string
  quantity: number
  status: OrderStatus
  order_date: string
  expected_delivery: string
  internal_notes: string | null
  updated_at: string
  school?: { name: string; code: string } | null
}
export const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  orderNo: r.order_no,
  schoolId: opt(r.school_id),
  customer: r.customer_name,
  service: r.service,
  quantity: r.quantity,
  status: r.status,
  orderDate: r.order_date,
  expectedDelivery: r.expected_delivery,
  notes: opt(r.internal_notes),
  updatedAt: r.updated_at,
})
export const toAdminOrder = (r: OrderRow) => ({ ...toOrder(r), schoolName: r.school?.name ?? r.customer_name, schoolCode: opt(r.school?.code) })

// ------------------------------------------------------------------ uploaded files
/** No storage bucket/path: those are read only when creating a download link. Administrator only (RLS). */
export const FILE_COLUMNS =
  'id, reference_no, original_name, file_type, size_bytes, storage_state, school_id, customer_name, uploaded_at, ' +
  'contact_person, contact_details, category, description, instructions, review_status, review_notes, reviewed_at, school:schools(name)'
export interface FileRow {
  id: string
  reference_no: string
  original_name: string
  file_type: UploadedFileType
  size_bytes: number
  storage_state: FileStorageState
  school_id: string | null
  customer_name: string | null
  uploaded_at: string
  contact_person: string | null
  contact_details: string | null
  category: FileCategory | null
  description: string | null
  instructions: string | null
  review_status: FileReviewStatus
  review_notes: string | null
  reviewed_at: string | null
  school?: { name: string } | null
}
export const toAdminFile = (r: FileRow) => ({
  id: r.id,
  referenceNo: r.reference_no,
  originalName: r.original_name,
  type: r.file_type,
  sizeBytes: Number(r.size_bytes),
  uploadedAt: r.uploaded_at,
  schoolId: opt(r.school_id),
  storageState: r.storage_state,
  schoolName: r.school?.name ?? opt(r.customer_name),
  contactPerson: opt(r.contact_person),
  contactDetails: opt(r.contact_details),
  category: opt(r.category),
  description: opt(r.description),
  instructions: opt(r.instructions),
  reviewStatus: r.review_status,
  reviewNotes: opt(r.review_notes),
  reviewedAt: opt(r.reviewed_at),
})

// ------------------------------------------------------------------ services
export const SERVICE_COLUMNS = 'id, slug, title, tagline, category, description, image_url, icon, enabled, display_order'
export interface ServiceRow {
  id: string
  slug: string
  title: string
  tagline: string
  category: ServiceCategory
  description: string
  image_url: string | null
  icon: string
  enabled?: boolean
  display_order: number
}
export const toService = (r: ServiceRow): Service => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  tagline: r.tagline,
  category: r.category,
  description: r.description,
  image: opt(r.image_url),
  icon: r.icon,
  enabled: r.enabled ?? true, // the public function returns enabled services only and omits the flag
  order: r.display_order,
})

// ------------------------------------------------------------------ advertisements
export const AD_COLUMNS = 'id, title, description, offer, image_url, icon, whatsapp_message, active, is_published, starts_at, ends_at, featured, created_at'
export interface AdRow {
  id: string
  title: string
  description: string
  offer: string | null
  image_url: string | null
  icon: string
  whatsapp_message: string
  active?: boolean
  is_published?: boolean
  starts_at: string | null
  ends_at: string | null
  featured: boolean
}
export const toAdvertisement = (r: AdRow): Advertisement => ({
  id: r.id,
  title: r.title,
  description: r.description,
  offer: opt(r.offer),
  image: opt(r.image_url),
  icon: r.icon,
  whatsappMessage: r.whatsapp_message,
  // The public function returns only live advertisements and omits these flags.
  active: r.active ?? true,
  isPublished: r.is_published ?? true,
  startsAt: opt(r.starts_at),
  endsAt: opt(r.ends_at),
  featured: r.featured,
})

// ------------------------------------------------------------------ feedback
export const FEEDBACK_COLUMNS = 'id, name, organization, rating, message, status, created_at'
export interface FeedbackRow {
  id: string
  name: string
  organization: string | null
  rating: number
  message: string
  status?: Feedback['status']
  created_at: string
}
export const toFeedback = (r: FeedbackRow): Feedback => ({
  id: r.id,
  name: r.name,
  organization: opt(r.organization),
  rating: r.rating as Feedback['rating'],
  message: r.message,
  status: r.status ?? 'approved', // the public function returns approved feedback only
  createdAt: r.created_at,
})
