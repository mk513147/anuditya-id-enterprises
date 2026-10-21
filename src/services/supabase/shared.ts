import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError, type RepositoryErrorCode } from '../errors'

/**
 * Helpers shared by the Supabase repositories. Rules they enforce for every module:
 *  - no client (missing/invalid settings) → RepositoryError('not_configured'), never demo data;
 *  - database errors become typed RepositoryErrors with OUR wording. Raw server messages/details (which can echo
 *    submitted values) are never shown to the user and never logged;
 *  - search text is reduced to a safe character set before it reaches a PostgREST filter;
 *  - pages are fetched with an exact count and clamped like the mock repositories do.
 */
export type Client = SupabaseClient

export function requireClient(client: Client | null): Client {
  if (!client) {
    throw new RepositoryError('not_configured', 'The site is not connected to its database. Please try again later or contact us.')
  }
  return client
}

/** The parts of a PostgREST / Storage / network error the mapping looks at. */
interface ErrorLike {
  code?: string
  message?: string
  status?: number
  statusCode?: string | number
  name?: string
}

const GENERIC: Record<RepositoryErrorCode, string> = {
  duplicate_code: 'That code is already used.',
  duplicate_slug: 'That link name is already used.',
  duplicate_admission_no: 'That admission number is already used by another student of this school.',
  duplicate_title: 'That name is already used.',
  not_found: 'That record was not found. It may have been changed by someone else; please refresh.',
  school_unavailable: 'This school is not accepting submissions.',
  invalid_status: 'That status is not supported.',
  invalid_id: 'That record id is not valid.',
  no_change: 'Nothing changed: the record is already in that state.',
  invalid_filter: 'One of the filters is not valid.',
  invalid_input: 'Some of the details are not valid. Please check them and try again.',
  not_configured: 'The site is not connected to its database. Please try again later or contact us.',
  permission_denied: 'You do not have permission to do that, or your session has expired. Please sign in again.',
  network: 'Could not reach the server. Check your connection and try again.',
  not_stored: 'There is no stored copy of this file.',
  duplicate_image: 'This image has already been added to this school.',
  unknown: 'Something went wrong. Please try again.',
}

export const repositoryError = (code: RepositoryErrorCode, message = GENERIC[code]) => new RepositoryError(code, message)

/**
 * Maps a Supabase / network error to a RepositoryError. `byMessage` lets a caller name the error codes its own
 * functions raise (e.g. 'school_unavailable'); `unique` names what a unique-violation means in that call.
 */
export function toRepositoryError(
  error: unknown,
  opts: { unique?: RepositoryErrorCode; byMessage?: Partial<Record<string, RepositoryErrorCode>> } = {},
): RepositoryError {
  if (error instanceof RepositoryError) return error
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const code = e.code ?? ''
  const message = e.message ?? ''
  const status = Number(e.status ?? e.statusCode ?? 0)

  const named = opts.byMessage?.[message]
  if (named) return repositoryError(named)
  if (message === 'not_authorized') return repositoryError('permission_denied')
  if (message === 'no_change') return repositoryError('no_change')
  if (message === 'school_unavailable') return repositoryError('school_unavailable')

  if (code === '42501' || code === 'PGRST301' || code === 'PGRST302' || status === 401 || status === 403) return repositoryError('permission_denied')
  if (code === 'P0002' || code === 'PGRST116') return repositoryError('not_found')
  if (code === '23505') return repositoryError(opts.unique ?? 'invalid_input', opts.unique ? undefined : 'That record already exists.')
  if (['23514', '23502', '22023', '22P02', '22007', '22008', '22001', '23503'].includes(code)) return repositoryError('invalid_input')
  // supabase-js reports fetch failures with no SQLSTATE code and the browser's TypeError text.
  if (!/^[0-9A-Z]{5}$/.test(code) && /fetch|network|load failed|timed? ?out|abort/i.test(`${e.name ?? ''} ${message}`)) return repositoryError('network')
  return repositoryError('unknown')
}

/**
 * Unwraps a Supabase result: throws the mapped error, otherwise returns the data. The client has no generated schema
 * types, so callers state the row shape they selected (e.g. `as SchoolRow[]`); every select names its columns.
 */
export function unwrap<T = unknown>(result: { data: unknown; error: unknown }, opts?: Parameters<typeof toRepositoryError>[1]): T {
  if (result.error) throw toRepositoryError(result.error, opts)
  return result.data as T
}

/** Runs a call, mapping thrown errors (e.g. fetch rejections) the same way as returned ones. */
export async function guarded<T>(run: () => Promise<T>, opts?: Parameters<typeof toRepositoryError>[1]): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw toRepositoryError(error, opts)
  }
}

/**
 * Search text reduced to letters, digits, spaces and . - / @ ' (enough for names, reference numbers and codes).
 * Removing PostgREST's reserved characters ( , ( ) " \ : ) and LIKE wildcards ( % _ * ) means a search can never change
 * the shape of a filter or match "everything" by accident.
 */
export function searchTerm(raw: string | undefined): string {
  return (raw ?? '').replace(/[^\p{L}\p{N} .\-/@']/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** A PostgREST `or` filter matching the (already sanitised) term in any of the columns, case-insensitively. */
export function ilikeAny(columns: string[], term: string): string {
  return columns.map((c) => `${c}.ilike."%${term}%"`).join(',')
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type RangeQuery = (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>

/**
 * Fetches one page with an exact count. An out-of-range page (e.g. after the last row on it was archived) is clamped to
 * the last page, as the mock repositories do.
 */
export async function fetchPage<R>(run: RangeQuery, page = 1, pageSize = 10): Promise<PageResult<R>> {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const wanted = Math.max(1, Math.floor(page) || 1)
  const first = await guarded(() => Promise.resolve(run((wanted - 1) * size, wanted * size - 1)))
  // PGRST103 = requested range not satisfiable (the offset is past the end).
  const rangeError = (first.error as { code?: string } | null)?.code === 'PGRST103'
  if (first.error && !rangeError) throw toRepositoryError(first.error)
  let rows = first.error ? [] : ((first.data ?? []) as R[])
  let total = first.count ?? rows.length
  if (rangeError || (rows.length === 0 && wanted > 1)) {
    if (rangeError || first.count === null) {
      const probe = await guarded(() => Promise.resolve(run(0, size - 1)))
      if (probe.error) throw toRepositoryError(probe.error)
      rows = (probe.data ?? []) as R[]
      total = probe.count ?? rows.length
    }
    const last = Math.max(1, Math.ceil(total / size))
    if (last > 1) {
      const again = await guarded(() => Promise.resolve(run((last - 1) * size, last * size - 1)))
      if (again.error) throw toRepositoryError(again.error)
      rows = (again.data ?? []) as R[]
      total = again.count ?? total
    }
    return { items: rows, total, page: last, pageSize: size, totalPages: last }
  }
  return { items: rows, total, page: wanted, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isRealDay = (v: string) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)

/**
 * Inclusive local-calendar-day range → timestamp bounds [start, endExclusive). Uses the browser's time zone, exactly like
 * the mock repositories' localDateISO comparison. Rejects 'invalid_filter' for unreal or reversed dates.
 */
export function localDayBounds(from?: string, to?: string): { gte?: string; lt?: string } {
  for (const d of [from, to]) if (d && !isRealDay(d)) throw new RepositoryError('invalid_filter', 'Dates must be real calendar dates.')
  if (from && to && from > to) throw new RepositoryError('invalid_filter', 'The "from" date must not be after the "to" date.')
  const start = (day: string) => new Date(`${day}T00:00:00`)
  const next = (day: string) => {
    const d = start(day)
    d.setDate(d.getDate() + 1)
    return d
  }
  return { gte: from ? start(from).toISOString() : undefined, lt: to ? next(to).toISOString() : undefined }
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Ids are UUIDs in the database. Anything else is rejected before a request is made. */
export function requireId(id: unknown, what: string): string {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', `A ${what} id is required.`)
  if (!isUuid(id.trim())) throw new RepositoryError('not_found', `${what[0].toUpperCase()}${what.slice(1)} not found.`)
  return id.trim()
}

/** Empty strings and nulls become undefined, matching the domain types' optional fields. */
export const opt = <T>(v: T | null | undefined): Exclude<T, null> | undefined => (v === null || v === undefined || v === '' ? undefined : (v as Exclude<T, null>))
