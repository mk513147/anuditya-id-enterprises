export type RepositoryErrorCode =
  | 'duplicate_code'
  | 'duplicate_slug'
  /** Another non-archived student in the same school already has this admission number. */
  | 'duplicate_admission_no'
  | 'not_found'
  /** The referenced school does not exist or is inactive. */
  | 'school_unavailable'
  /** The value is not one of the supported order statuses. */
  | 'invalid_status'
  /** The identifier is missing or not a usable id. */
  | 'invalid_id'
  /** The order is already in the requested status. */
  | 'no_change'
  /** A list filter is malformed (unknown file type, bad date, or a reversed date range). */
  | 'invalid_filter'
  /** Submitted values break a validation rule; `fieldErrors` says which. */
  | 'invalid_input'
  /** Another service already has this name (names are what enquiries and quotes refer to). */
  | 'duplicate_title'
  /** The live data source is selected but the Supabase settings are missing or invalid. Never silently replaced by demo data. */
  | 'not_configured'
  /** The database refused the request: not signed in as the administrator, or the session has expired. */
  | 'permission_denied'
  /** The server could not be reached (offline, DNS, timeout). Safe to retry. */
  | 'network'
  /** The record has no stored file (a metadata-only record), so there is nothing to download or show. */
  | 'not_stored'
  /** Anything the data layer could not classify. The message is generic: raw server details are never shown. */
  | 'unknown'

/** Typed failure that repositories reject with, so the UI can react to specific cases. */
export class RepositoryError extends Error {
  code: RepositoryErrorCode
  /** For duplicate_slug: the next free slug the caller could use instead. */
  suggestion?: string
  /** For invalid_input: message per field name, so a form can show each one inline. */
  fieldErrors?: Record<string, string>

  constructor(code: RepositoryErrorCode, message: string, suggestion?: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
    this.suggestion = suggestion
    this.fieldErrors = fieldErrors
  }
}

export const isRepositoryError = (e: unknown, code?: RepositoryErrorCode): e is RepositoryError =>
  e instanceof RepositoryError && (code === undefined || e.code === code)

/**
 * Text to show for a failed request. A RepositoryError's message is always our own wording (raw server details are never
 * put in it), so it can be shown; anything else gets the caller's fallback.
 */
export const describeError = (e: unknown, fallback: string): string => (e instanceof RepositoryError ? e.message : fallback)
