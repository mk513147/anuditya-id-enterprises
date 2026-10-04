import type { Advertisement, FileUploadResult, Feedback, Service, StudentSubmission, StudentSubmissionResult } from '@/types'

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

export interface StudentRepository {
  /** Stores a student submission and returns its reference number. Rejects on failure. */
  submit(input: StudentSubmission): Promise<StudentSubmissionResult>
}

export interface FileUploadOptions {
  /** Called with 0–100 as the upload proceeds. */
  onProgress: (percent: number) => void
}

export interface FileRepository {
  /** Uploads a validated file. Rejects on failure. Real implementation: Supabase Storage + metadata row. */
  upload(file: File, options: FileUploadOptions): Promise<FileUploadResult>
}
