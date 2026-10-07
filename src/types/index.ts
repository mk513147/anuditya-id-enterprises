/** Domain types. Mock services and a future Supabase layer both return these. */

export type ID = string
export type ISODate = string

export interface School {
  id: ID
  name: string
  /** URL-safe identifier used in the public link: /school/:slug. Unique. NOT a security mechanism. */
  slug: string
  /** Short internal code, e.g. STM-001. Unique. */
  code: string
  contactPerson: string
  phone: string
  email?: string
  address?: string
  isActive: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

/** Editable school fields (everything the admin form controls). */
export type SchoolInput = Pick<School, 'name' | 'slug' | 'code' | 'contactPerson' | 'phone' | 'email' | 'address'>

export interface Student {
  id: ID
  referenceNo: string // e.g. ANU-2026-00001
  /** Owning school. Explicit relationship by ID. */
  schoolId: ID
  name: string
  fatherName: string
  motherName: string
  dob: ISODate
  className: string
  section: string
  rollNo: string
  admissionNo: string
  address: string
  mobile: string
  photoUrl?: string
  // Optional details (not yet confirmed as mandatory by the client)
  bloodGroup?: string
  houseName?: string
  houseColour?: string
  busRoute?: string
  busStoppage?: string
  submittedAt: ISODate
  updatedAt: ISODate
  /**
   * Soft-archive flag. Students are never permanently deleted: an archived student leaves the default
   * list but keeps its record, reference number and school association (and any history that points at it).
   */
  isArchived: boolean
  archivedAt?: ISODate
}

/** The fields an admin may edit. School and reference number are deliberately NOT editable. */
export type StudentEditInput = Pick<
  Student,
  | 'name' | 'fatherName' | 'motherName' | 'dob' | 'className' | 'section' | 'rollNo' | 'admissionNo' | 'address' | 'mobile'
  | 'bloodGroup' | 'houseName' | 'houseColour' | 'busRoute' | 'busStoppage'
>

/** What the UI submits. The photo is required; the repository decides how to store it. */
export type StudentSubmission = Omit<Student, 'id' | 'referenceNo' | 'submittedAt' | 'updatedAt' | 'isArchived' | 'archivedAt' | 'photoUrl'> & { photo: File }

export interface StudentSubmissionResult {
  referenceNo: string
  submittedAt: ISODate
  schoolName: string
}

export const ORDER_STATUSES = [
  'Order Received',
  'Data Verification',
  'Designing',
  'Printing',
  'Quality Check',
  'Ready',
  'Dispatched',
  'Delivered',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface Order {
  id: ID
  orderNo: string
  /** Owning school, when the order belongs to one. */
  schoolId?: ID
  customer: string // customer / school name (display)
  service: string
  quantity: number
  status: OrderStatus
  orderDate: ISODate
  expectedDelivery: ISODate
  /** Internal notes. Never exposed by the public tracking lookup. */
  notes?: string
}

/**
 * What the public Job Status page may see. Deliberately a whitelist: no id, school id, internal notes
 * or contact details. (Orders have no cancellation concept yet, so there is no cancelled state.)
 */
export type PublicOrder = Pick<Order, 'orderNo' | 'customer' | 'service' | 'quantity' | 'status' | 'orderDate' | 'expectedDelivery'>

export type UploadedFileType = 'xlsx' | 'xls' | 'csv'

/** Stored file metadata (what a database row / storage object would hold). */
export interface UploadedFile {
  id: ID
  referenceNo: string // e.g. FILE-2026-00001
  originalName: string
  /** Internal storage location. Never shown to users. */
  storagePath: string
  type: UploadedFileType
  sizeBytes: number
  uploadedAt: ISODate
  /** School / customer, when known (not collected on the public upload page). */
  schoolId?: ID
  customer?: string
}

/** What the public UI receives after an upload: no internal storage details. */
export type FileUploadResult = Pick<UploadedFile, 'referenceNo' | 'originalName' | 'type' | 'sizeBytes' | 'uploadedAt'>

export type ServiceCategory = 'id-cards' | 'school-materials' | 'design-printing'

export interface Service {
  id: ID
  slug: string
  title: string
  /** Short card subtitle, e.g. "Student & Staff" */
  tagline: string
  category: ServiceCategory
  description: string
  /** Real photo URL. When empty the UI renders a branded placeholder. */
  image?: string
  /** Key into the placeholder icon map (see lib/icons.ts) */
  icon: string
  enabled: boolean
  order: number
}

export interface Advertisement {
  id: ID
  title: string
  description: string
  offer?: string
  /** Real banner URL. When empty the UI renders a branded placeholder. */
  image?: string
  icon: string
  whatsappMessage: string
  /** Enabled by an admin. A disabled advertisement is never public. */
  active: boolean
  /** false = draft. Drafts are never public, whatever their dates. */
  isPublished: boolean
  /** Optional visibility window. Outside it (not started / expired) the advertisement is hidden. */
  startsAt?: ISODate
  endsAt?: ISODate
  featured: boolean
}

export type FeedbackStatus = 'pending' | 'approved' | 'rejected'
export interface Feedback {
  id: ID
  name: string
  organization?: string
  rating: 1 | 2 | 3 | 4 | 5
  message: string
  status: FeedbackStatus
  createdAt: ISODate
}

/** What the public feedback form submits. New feedback is always stored as pending approval. */
export type FeedbackInput = Pick<Feedback, 'name' | 'organization' | 'rating' | 'message'>

export interface FeedbackSubmissionResult {
  id: ID
  status: 'pending'
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
