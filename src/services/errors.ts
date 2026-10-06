export type RepositoryErrorCode =
  | 'duplicate_code'
  | 'duplicate_slug'
  /** Another non-archived student in the same school already has this admission number. */
  | 'duplicate_admission_no'
  | 'not_found'
  /** The referenced school does not exist or is inactive. */
  | 'school_unavailable'

/** Typed failure that repositories reject with, so the UI can react to specific cases. */
export class RepositoryError extends Error {
  code: RepositoryErrorCode
  /** For duplicate_slug: the next free slug the caller could use instead. */
  suggestion?: string

  constructor(code: RepositoryErrorCode, message: string, suggestion?: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
    this.suggestion = suggestion
  }
}

export const isRepositoryError = (e: unknown, code?: RepositoryErrorCode): e is RepositoryError =>
  e instanceof RepositoryError && (code === undefined || e.code === code)
