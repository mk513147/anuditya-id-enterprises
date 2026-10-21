import type { AdVisibility } from '@/lib/advertisements'
import type { FileReviewEvent, FileReviewStatus, SchoolFileSubmission, SchoolImage, Advertisement, ServiceCategory, ServiceInput, AdvertisementInput, FeedbackStatus, OrderInput, OrderStatus, FeedbackInput, FeedbackSubmissionResult, FileUploadResult, Feedback, UploadedFile, UploadedFileType, ID, PublicOrder, Order, PagedResult, School, SchoolInput, Service, Student, StudentApprovalStatus, StudentEditInput, StudentSubmission, StudentSubmissionResult } from '@/types'

/**
 * Repository contracts. The UI depends only on these interfaces. Two implementations exist: `services/supabase/*`
 * (live data) and `services/mock/*` (in-memory demo data); `services/index.ts` picks one (see runtime.ts).
 *
 * Every method may also reject with RepositoryError('not_configured' | 'permission_denied' | 'network' | 'unknown')
 * when the live backend is unavailable; those are never replaced with demo data.
 */
export interface ServiceRepository {
  /** Enabled services, sorted by `order`. Disabled services never leave this function. */
  listPublic(): Promise<Service[]>
  /** Admin list: every service whatever its state, sorted by `order`. Rejects 'invalid_filter' for a malformed filter. */
  list(params?: ServiceListParams): Promise<ServiceListResult>
  /** Rejects with RepositoryError('invalid_id' | 'not_found'). */
  getDetail(id: ID): Promise<Service>
  /** Rejects 'invalid_input' (with `fieldErrors`) or 'duplicate_title' and then stores nothing. The new service is shown last. */
  create(input: ServiceInput): Promise<Service>
  /**
   * Changes only the fields present in `patch`; everything else (including slug and order) is kept. The merged
   * result is validated. Rejects 'invalid_id' | 'not_found' | 'invalid_input' | 'duplicate_title' and leaves the record untouched.
   */
  update(id: ID, patch: Partial<ServiceInput>): Promise<Service>
  /** Enable / disable. Rejects 'invalid_id' | 'not_found' | 'invalid_input' (not a boolean) | 'no_change'. Services are never deleted. */
  setEnabled(id: ID, enabled: boolean): Promise<Service>
}

export interface ServiceListParams {
  /** Matches the service name, case-insensitive. */
  search?: string
  category?: 'all' | ServiceCategory
  status?: 'all' | 'enabled' | 'disabled'
  page?: number
  pageSize?: number
}

export interface ServiceListResult extends PagedResult<Service> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { total: number; enabled: number; disabled: number; byCategory: Record<ServiceCategory, number> }
}

export interface AdvertisementRepository {
  /**
   * Advertisements the public may see right now: enabled, published, started and not expired.
   * `now` is injectable so the rule can be tested at fixed instants.
   */
  listPublic(now?: Date): Promise<Advertisement[]>
  /** Admin list: every advertisement, whatever its state, most recently added first. */
  list(params?: AdvertisementListParams): Promise<AdvertisementListResult>
  /** Rejects with RepositoryError('invalid_id' | 'not_found'). */
  getDetail(id: ID, now?: Date): Promise<AdminAdvertisement>
  /** Rejects with RepositoryError('invalid_input') (with `fieldErrors`) and then stores nothing. */
  create(input: AdvertisementInput): Promise<Advertisement>
  /**
   * Changes only the fields present in `patch`; everything else is kept. The merged result is validated.
   * Rejects with RepositoryError('invalid_id' | 'not_found' | 'invalid_input') and leaves the record untouched.
   */
  update(id: ID, patch: Partial<AdvertisementInput>): Promise<Advertisement>
  /** Enable / disable. Rejects 'invalid_id' | 'not_found' | 'invalid_input' (not a boolean) | 'no_change'. */
  setActive(id: ID, active: boolean): Promise<Advertisement>
  /** Publish / unpublish (back to draft). Same rejections as setActive. */
  setPublished(id: ID, published: boolean): Promise<Advertisement>
}

export interface AdminAdvertisement extends Advertisement {
  /** live = public right now; scheduled = not started; ended = past its end date; hidden = disabled or a draft. */
  visibility: AdVisibility
}

export interface AdvertisementListParams {
  /** Matches the title, case-insensitive. */
  search?: string
  published?: 'all' | 'published' | 'draft'
  active?: 'all' | 'enabled' | 'disabled'
  visibility?: 'all' | AdVisibility
  /** An India calendar day (YYYY-MM-DD): only advertisements whose schedule window includes that day. */
  runsOn?: string
  page?: number
  pageSize?: number
  /** Injectable clock so visibility can be tested at fixed instants. */
  now?: Date
}

export interface AdvertisementListResult extends PagedResult<AdminAdvertisement> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { total: number; live: number; scheduled: number; ended: number; hidden: number; drafts: number; disabled: number }
}

export interface FeedbackRepository {
  /** Approved feedback only, newest first. Pending and rejected feedback never leave the data layer. */
  listApproved(): Promise<Feedback[]>
  /** Stores new feedback as PENDING approval. Rejects on failure and then stores nothing. */
  submit(input: FeedbackInput): Promise<FeedbackSubmissionResult>
  /** Admin moderation queue: every submission, pending first, then newest. Rejects 'invalid_filter' for a malformed filter. */
  list(params?: FeedbackListParams): Promise<FeedbackListResult>
  /** Rejects with RepositoryError('invalid_id' | 'not_found'). */
  getDetail(id: ID): Promise<Feedback>
  /**
   * Sets the moderation decision. Any status may follow any other (a decision can be reversed, or sent
   * back to pending); only 'approved' feedback is ever public. Rejects 'invalid_id' | 'invalid_status' |
   * 'not_found' | 'no_change' and leaves the record untouched.
   */
  setStatus(id: ID, status: FeedbackStatus): Promise<Feedback>
}

export interface FeedbackListParams {
  /** Matches the submitter's name or the message, case-insensitive. */
  search?: string
  status?: 'all' | FeedbackStatus
  rating?: 'all' | 1 | 2 | 3 | 4 | 5
  page?: number
  pageSize?: number
}

export interface FeedbackListResult extends PagedResult<Feedback> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { total: number; pending: number; approved: number; rejected: number }
}

export interface OrderRepository {
  /**
   * Public order lookup. BOTH the exact order number (case-insensitive, whitespace tolerant) AND the order's current
   * tracking code are required; the number alone is guessable and is not enough. Returns null when either is wrong or
   * malformed (deliberately indistinguishable), never a partial or fuzzy match. Returns a whitelisted PublicOrder, never
   * the stored Order. Rejects on failure.
   */
  track(orderNo: string, trackingCode: string): Promise<PublicOrder | null>
  /**
   * Creates an order. The order number and the tracking code are generated by the data layer. The tracking code is
   * returned ONCE here (only a hash is stored) so the administrator can give it to the customer.
   * Rejects 'invalid_input' (with `fieldErrors`) or 'not_found' (unknown school) and then stores nothing.
   */
  create(input: OrderInput): Promise<CreatedOrder>
  /** Issues a new tracking code and invalidates the previous one. Returned once. Rejects 'invalid_id' | 'not_found'. */
  rotateTrackingCode(id: ID): Promise<string>
  /** Admin list, newest order first. Reads the same orders the public lookup reads. */
  list(params?: OrderListParams): Promise<OrderListResult>
  /** Rejects with RepositoryError('invalid_id' | 'not_found'). */
  getDetail(id: ID): Promise<AdminOrder>
  /**
   * Moves an order to `status` (any supported status; the caller decides, nothing advances automatically)
   * and records the change. Writes to the same store the public lookup reads, so tracking reflects it
   * immediately. Rejects with RepositoryError('invalid_id' | 'invalid_status' | 'not_found' | 'no_change')
   * and leaves the order untouched.
   */
  updateStatus(id: ID, status: OrderStatus): Promise<AdminOrder>
}

/** An order joined with its school's current display fields. Orders belong to schools, not to students. */
export interface AdminOrder extends Order {
  schoolName: string
  schoolCode?: string
}

export interface OrderListParams {
  /** Matches the order reference or the school name, case-insensitive. */
  search?: string
  status?: 'all' | OrderStatus
  /** Inclusive order-date range (YYYY-MM-DD). */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface CreatedOrder {
  order: AdminOrder
  /** Shown once to the administrator; never stored in plaintext, never put in a URL or a log. */
  trackingCode: string
}

export interface OrderListResult extends PagedResult<AdminOrder> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { total: number; byStatus: Record<OrderStatus, number> }
}

/** A student joined with its school's display fields, so lists never match schools by name. */
export interface AdminStudent extends Student {
  schoolName: string
  schoolCode: string
  schoolActive: boolean
}

export interface StudentListParams {
  /** Matches name, reference number, admission number or roll number (case-insensitive). */
  search?: string
  schoolId?: ID
  className?: string
  section?: string
  /** Default 'active': archived students are hidden unless asked for. */
  status?: 'active' | 'archived' | 'all'
  /** Review decision filter. Default 'all'. */
  approval?: 'all' | StudentApprovalStatus
  /** Inclusive local-date range (YYYY-MM-DD) on the submission date. */
  submittedFrom?: string
  submittedTo?: string
  page?: number
  pageSize?: number
}

export interface StudentListResult extends PagedResult<AdminStudent> {
  totalPages: number
  /** Overall totals, independent of the filters. pending/approved/rejected count non-archived students. */
  counts: { active: number; archived: number; pending: number; approved: number; rejected: number }
}

export interface StudentDetail {
  student: AdminStudent
  /**
   * Orders placed by the student's school, newest first. Orders reference schools, not individual
   * students, so this is school-level context rather than a per-student link.
   */
  schoolOrders: Order[]
}

export interface StudentFilterOptions {
  sections: string[]
}

export interface StudentRepository {
  /** Stores a student submission and returns its reference number. Rejects on failure. */
  submit(input: StudentSubmission): Promise<StudentSubmissionResult>
  list(params?: StudentListParams): Promise<StudentListResult>
  /** Rejects with RepositoryError('not_found'). */
  getDetail(id: ID): Promise<StudentDetail>
  /**
   * Updates editable fields only. The reference number and school can never change here.
   * Rejects with RepositoryError('not_found' | 'duplicate_admission_no') and leaves the record untouched.
   */
  update(id: ID, input: StudentEditInput): Promise<Student>
  /** Soft archive / restore. Never deletes, and never touches orders or the school. */
  setArchived(id: ID, archived: boolean): Promise<Student>
  getFilterOptions(): Promise<StudentFilterOptions>
  /**
   * Records the administrator's review decision ('pending' sends it back to the queue).
   * Rejects 'invalid_id' | 'invalid_status' | 'not_found' | 'no_change' and leaves the record untouched.
   */
  review(id: ID, decision: StudentApprovalStatus): Promise<Student>
  /**
   * Every student matching the filters (ignoring page/pageSize), in list order, for a CSV export.
   * Capped at STUDENT_EXPORT_LIMIT rows; `truncated` says when the cap was hit.
   */
  exportRows(params?: StudentListParams): Promise<{ rows: AdminStudent[]; truncated: boolean }>
  /**
   * Downloads the photographs of the given students for an administrator export, at most `concurrency` at a time,
   * reporting each one through `onPhoto` (also for students with no photo). Storage paths and links never leave the
   * repository. Stops starting new downloads when `signal` is aborted. Rejects only if the photo records cannot be read.
   */
  downloadPhotos(ids: ID[], options: PhotoDownloadOptions): Promise<void>
}

export type StudentPhotoResult = { status: 'ok'; blob: Blob } | { status: 'missing' } | { status: 'failed' }

export interface PhotoDownloadOptions {
  concurrency: number
  signal?: AbortSignal
  onPhoto: (id: ID, result: StudentPhotoResult) => void
}

/** Upper bound on one export, so a single click cannot pull an unbounded amount of personal data. */
export const STUDENT_EXPORT_LIMIT = 5000

export interface FileUploadOptions {
  /** Called with 0–100 as the upload proceeds. */
  onProgress: (percent: number) => void
}

export interface FileRepository {
  /**
   * Public "Submit School Data File". Validates every field and the file, stores the file privately, then registers the
   * submission as PENDING review. Resolves only when both steps succeeded. Rejects 'invalid_input' (with `fieldErrors`),
   * 'school_unavailable', or a transport error; nothing is reported as submitted on failure.
   */
  submit(input: SchoolFileSubmission, options: FileUploadOptions): Promise<FileUploadResult>
  /** Admin list of stored file records, newest upload first. Rejects RepositoryError('invalid_filter') for a malformed filter. */
  list(params?: FileListParams): Promise<FileListResult>
  /** Rejects with RepositoryError('invalid_id' | 'not_found'). Metadata and review history only: never storage paths or file bytes. */
  getDetail(id: ID): Promise<AdminFileDetail>
  /**
   * Administrator review: sets the decision and REPLACES the notes (empty clears them). Rejects 'invalid_id' | 'not_found'
   * | 'invalid_status' | 'invalid_input' (notes too long) | 'no_change'. Enforced again by the database.
   */
  review(id: ID, status: FileReviewStatus, notes?: string): Promise<AdminFileDetail>
  /**
   * A short-lived link (about a minute) to download a stored file. Administrator only. The link is used straight away
   * and never stored, logged or put in the page URL. Rejects 'invalid_id' | 'not_found' | 'not_stored'.
   */
  getDownloadUrl(id: ID): Promise<string>
}

/**
 * A stored file record as the admin sees it. The internal `storagePath` is deliberately left out.
 * `storageState` says whether there are bytes to download ('stored') or only this record ('metadata_only').
 */
export type AdminFile = Omit<UploadedFile, 'storagePath' | 'customer'> & {
  /** Display name of the associated school. Undefined for older uploads that carried no school. */
  schoolName?: string
}

export type AdminFileDetail = AdminFile & {
  /** Review decisions, oldest first. */
  reviewHistory: FileReviewEvent[]
}

export interface FileListParams {
  /** Matches the original file name or the file reference, case-insensitive. */
  search?: string
  /** A school id, 'none' for files with no school, or empty/undefined for all. */
  schoolId?: string
  type?: 'all' | UploadedFileType
  reviewStatus?: 'all' | FileReviewStatus
  /** Inclusive local-date range (YYYY-MM-DD) on the upload date. */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface FileListResult extends PagedResult<AdminFile> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { total: number; totalBytes: number; byType: Record<UploadedFileType, number>; byReview: Record<FileReviewStatus, number> }
}

export interface SchoolListParams {
  /** Matches school name or code, case-insensitive. */
  search?: string
  status?: 'all' | 'active' | 'inactive'
}

export interface SchoolDetail {
  school: School
  studentCount: number
  orderCount: number
  fileCount: number
}

/**
 * Result of opening /school/:slug. 'inactive' deliberately carries no school details, so the public
 * page cannot leak anything about a deactivated school.
 */
export type SchoolResolution = { status: 'active'; school: PublicSchool & Pick<School, 'slug'> } | { status: 'inactive' } | { status: 'not_found' }

/** The only school fields the public may see. */
export type PublicSchool = Pick<School, 'id' | 'name'>

export interface SchoolRepository {
  list(params?: SchoolListParams): Promise<School[]>
  /** Active schools only, for the public school dropdown: id and name, nothing else. */
  listActive(): Promise<PublicSchool[]>
  /** Rejects with RepositoryError('not_found'). */
  getDetail(id: ID): Promise<SchoolDetail>
  resolveBySlug(slug: string): Promise<SchoolResolution>
  /** Rejects with RepositoryError('duplicate_code' | 'duplicate_slug'). */
  create(input: SchoolInput): Promise<School>
  /** Rejects with RepositoryError('not_found' | 'duplicate_code' | 'duplicate_slug'). */
  update(id: ID, input: SchoolInput): Promise<School>
  setActive(id: ID, isActive: boolean): Promise<School>
  /** The school's images, primary first then in display order, each with a short-lived preview link. Administrator only. */
  listImages(schoolId: ID): Promise<SchoolImage[]>
  /**
   * Uploads ONE validated image for the school and registers it (the first image of a school becomes its primary image;
   * later ones never replace it). Rejects 'invalid_input' (file problems), 'duplicate_image' (already added),
   * 'not_found' (unknown school), 'permission_denied' or a transport error. Storage and the database are separate: if the
   * registration fails after the upload, the uploaded object is removed again where possible.
   */
  uploadImage(schoolId: ID, file: File, options?: { altText?: string }): Promise<SchoolImage>
  /** Makes an image the school's primary image (the previous one stays, as a normal image). Rejects 'not_found' | 'no_change'. */
  setPrimaryImage(imageId: ID): Promise<void>
}

export interface DashboardCounts {
  totalSchools: number
  activeSchools: number
  /** Non-archived student records, whatever their review state. */
  totalStudents: number
  /** Non-archived submissions waiting for the administrator's review. */
  pendingStudentReviews: number
  /** Orders not yet started: Order Received or Data Verification. */
  pendingOrders: number
  uploadedFiles: number
  /** Submitted files waiting for the administrator's review. */
  pendingFileReviews: number
  /** Every order that is not yet Delivered. */
  awaitingCompletion: number
  /** Feedback waiting for moderation. */
  pendingFeedback: number
}

/** Only what the dashboard card shows; contact details are not loaded for it. */
export type RecentSchool = Pick<School, 'id' | 'name' | 'code' | 'isActive' | 'createdAt'> & { studentCount: number }

/**
 * The dashboard's widgets load independently, so one failing widget (e.g. a network error) shows its own error
 * and retry while the others still render.
 */
export interface DashboardRepository {
  getCounts(): Promise<DashboardCounts>
  /** The five most recent orders by order date. */
  getRecentOrders(): Promise<Order[]>
  /** The four most recently added schools, with their non-archived student counts. */
  getRecentSchools(): Promise<RecentSchool[]>
}
