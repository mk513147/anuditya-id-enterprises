import type { Advertisement, FileUploadResult, Feedback, ID, Order, PagedResult, School, SchoolInput, Service, Student, StudentEditInput, StudentSubmission, StudentSubmissionResult } from '@/types'

/**
 * Repository contracts. The UI depends only on these interfaces;
 * a Supabase implementation can replace `services/mock/*` later.
 */
export interface ServiceRepository {
  /** Enabled services, sorted by `order`. */
  listPublic(): Promise<Service[]>
}

export interface AdvertisementRepository {
  /** Active advertisements only. */
  listPublic(): Promise<Advertisement[]>
}

export interface FeedbackRepository {
  /** Approved feedback only. */
  listApproved(): Promise<Feedback[]>
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
  /** Inclusive local-date range (YYYY-MM-DD) on the submission date. */
  submittedFrom?: string
  submittedTo?: string
  page?: number
  pageSize?: number
}

export interface StudentListResult extends PagedResult<AdminStudent> {
  totalPages: number
  /** Overall totals, independent of the filters. */
  counts: { active: number; archived: number }
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
}

export interface FileUploadOptions {
  /** Called with 0–100 as the upload proceeds. */
  onProgress: (percent: number) => void
}

export interface FileRepository {
  /** Uploads a validated file. Rejects on failure. Real implementation: Supabase Storage + metadata row. */
  upload(file: File, options: FileUploadOptions): Promise<FileUploadResult>
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
export type SchoolResolution = { status: 'active'; school: School } | { status: 'inactive' } | { status: 'not_found' }

export interface SchoolRepository {
  list(params?: SchoolListParams): Promise<School[]>
  /** Active schools only, for the public school dropdown. */
  listActive(): Promise<School[]>
  /** Rejects with RepositoryError('not_found'). */
  getDetail(id: ID): Promise<SchoolDetail>
  resolveBySlug(slug: string): Promise<SchoolResolution>
  /** Rejects with RepositoryError('duplicate_code' | 'duplicate_slug'). */
  create(input: SchoolInput): Promise<School>
  /** Rejects with RepositoryError('not_found' | 'duplicate_code' | 'duplicate_slug'). */
  update(id: ID, input: SchoolInput): Promise<School>
  setActive(id: ID, isActive: boolean): Promise<School>
}

export interface DashboardData {
  counts: {
    totalSchools: number
    activeSchools: number
    totalStudents: number
    /** Orders not yet started: Order Received or Data Verification. */
    pendingOrders: number
    uploadedFiles: number
    /** Every order that is not yet Delivered. */
    awaitingCompletion: number
  }
  recentOrders: Order[]
  recentSchools: (School & { studentCount: number })[]
}

export interface DashboardRepository {
  get(): Promise<DashboardData>
}
