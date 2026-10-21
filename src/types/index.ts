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

/** An image of a school (administrator only). Stored privately; `url` is a short-lived link for showing it. */
export interface SchoolImage {
  id: ID
  schoolId: ID
  originalName: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  altText?: string
  isPrimary: boolean
  displayOrder: number
  createdAt: ISODate
  /** Short-lived preview link (a few minutes). Never stored or logged. */
  url: string
  /** Administrator uploads are approved immediately; public submissions wait for review. Only approved images can be primary. */
  reviewStatus: SchoolImageStatus
  source: 'admin' | 'public'
  /** Who submitted it (public submissions only). Administrator only. */
  submission?: { contactPerson: string; contactDetails: string; note?: string }
  reviewedAt?: ISODate
}

export type SchoolImageStatus = 'pending' | 'approved' | 'rejected'

/** The details the public "Submit School Images" form sends with each image. */
export interface SchoolImageSubmission {
  schoolId: ID
  contactPerson: string
  /** An email address or a 10-digit mobile number. */
  contactDetails: string
  note?: string
}

/** Outcome of one public image submission: stored for review, or the school already has this exact image. */
export type SchoolImageSubmitResult = 'submitted' | 'already_present'

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
  /**
   * Review decision. Every public submission starts 'pending'; only the administrator approves or rejects it.
   * Pending and rejected records are visible to the administrator only.
   */
  approvalStatus: StudentApprovalStatus
  /** When the current decision was made. Absent while pending. */
  reviewedAt?: ISODate
}

export const STUDENT_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const
export type StudentApprovalStatus = (typeof STUDENT_APPROVAL_STATUSES)[number]

/** The fields an admin may edit. School and reference number are deliberately NOT editable. */
export type StudentEditInput = Pick<
  Student,
  | 'name' | 'fatherName' | 'motherName' | 'dob' | 'className' | 'section' | 'rollNo' | 'admissionNo' | 'address' | 'mobile'
  | 'bloodGroup' | 'houseName' | 'houseColour' | 'busRoute' | 'busStoppage'
>

/** What the UI submits. The photo is required; the repository decides how to store it. */
export type StudentSubmission = Omit<
  Student,
  'id' | 'referenceNo' | 'submittedAt' | 'updatedAt' | 'isArchived' | 'archivedAt' | 'photoUrl' | 'approvalStatus' | 'reviewedAt'
> & { photo: File }

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

/** One recorded status change. Seeded demo orders start with none; only real changes are recorded. */
export interface OrderStatusChange {
  status: OrderStatus
  at: ISODate
}

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
  /** Status changes made through the admin panel, oldest first. Internal: never exposed publicly. */
  statusHistory?: OrderStatusChange[]
  /** Set whenever an admin changes the status. */
  updatedAt?: ISODate
}

/**
 * What the public Job Status page may see. Deliberately a whitelist: no id, school id, internal notes
 * or contact details. (Orders have no cancellation concept yet, so there is no cancelled state.)
 */
export type PublicOrder = Pick<Order, 'orderNo' | 'customer' | 'service' | 'quantity' | 'status' | 'orderDate' | 'expectedDelivery'>

/**
 * What the administrator enters to create an order. The order number and the tracking code are generated by the data
 * layer. With a school, the customer name is the school's name; without one, `customer` is required.
 */
export interface OrderInput {
  schoolId?: ID
  customer?: string
  service: string
  quantity: number
  orderDate: ISODate
  expectedDelivery: ISODate
  notes?: string
}

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
  /** 'stored' = the file's bytes are in private storage and can be downloaded; 'metadata_only' = only this record exists. */
  storageState: FileStorageState
  /**
   * Submission details from the public "Submit School Data File" form. Absent on records made before that form existed.
   * Contact details are for the administrator only: they never appear in any public response.
   */
  contactPerson?: string
  contactDetails?: string
  category?: FileCategory
  description?: string
  instructions?: string
  /** Every submission starts 'pending'; only the administrator changes it. */
  reviewStatus: FileReviewStatus
  /** The administrator's notes (internal). */
  reviewNotes?: string
  reviewedAt?: ISODate
}

export const FILE_CATEGORIES = ['student_data', 'design_materials', 'data_corrections', 'other'] as const
export type FileCategory = (typeof FILE_CATEGORIES)[number]
export const FILE_CATEGORY_LABEL: Record<FileCategory, string> = {
  student_data: 'Student data / student list',
  design_materials: 'Design or printing materials',
  data_corrections: 'Corrections to previously submitted data',
  other: 'Other',
}

export const FILE_REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'corrections_required'] as const
export type FileReviewStatus = (typeof FILE_REVIEW_STATUSES)[number]
export const FILE_REVIEW_LABEL: Record<FileReviewStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  corrections_required: 'Corrections required',
}

/** One recorded review decision (administrator only). */
export interface FileReviewEvent {
  status: FileReviewStatus
  notes?: string
  at: ISODate
}

/** What the public form submits. The file is validated in the browser and again by storage and the database. */
export interface SchoolFileSubmission {
  schoolId: ID
  contactPerson: string
  /** An email address or a 10-digit mobile number. */
  contactDetails: string
  category: FileCategory
  description: string
  instructions?: string
  file: File
}

export type FileStorageState = 'stored' | 'metadata_only'

/** What the public UI receives after an upload: no internal storage details. */
export type FileUploadResult = Pick<UploadedFile, 'referenceNo' | 'originalName' | 'type' | 'sizeBytes' | 'uploadedAt'> & { schoolName?: string }

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

/** The fields an admin controls. id, slug and display order are assigned by the data layer. */
export type ServiceInput = Pick<Service, 'title' | 'tagline' | 'category' | 'description' | 'image' | 'icon' | 'enabled'>

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

/** The fields an admin controls. Everything else on an Advertisement (its id) is assigned by the data layer. */
export type AdvertisementInput = Pick<
  Advertisement,
  'title' | 'description' | 'offer' | 'image' | 'icon' | 'whatsappMessage' | 'active' | 'isPublished' | 'featured' | 'startsAt' | 'endsAt'
>

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
