import { nextFreeSlug } from '@/lib/slug'
import type { SchoolImage, SchoolImageStatus, SchoolInput } from '@/types'
import { normalizeContact } from '@/validations/fileSubmission'
import { inspectImage, schoolImageSubmissionSchema, type ImageCheck } from '@/validations/schoolImage'
import { parseInput } from '../validate'
import { RepositoryError } from '../errors'
import type { SchoolRepository } from '../types'
import { SCHOOL_COLUMNS, toSchool, type SchoolRow } from './rows'
import { guarded, ilikeAny, isUuid, requireClient, requireId, searchTerm, toRepositoryError, unwrap, type Client } from './shared'

const clean = (input: SchoolInput) => ({
  name: input.name.trim(),
  slug: input.slug.trim().toLowerCase(),
  code: input.code.trim().toUpperCase(),
  contact_person: input.contactPerson.trim(),
  phone: input.phone.trim(),
  email: input.email?.trim() || null,
  address: input.address?.trim() || null,
})

/**
 * A unique violation on schools is either the code or the slug. Which one is decided by asking the database (the error
 * text is never parsed or shown), and for a slug the next free one is suggested, as the mock does.
 */
async function duplicateError(c: Client, data: ReturnType<typeof clean>, exceptId?: string): Promise<RepositoryError> {
  const others = unwrap(await guarded(() => Promise.resolve(c.from('schools').select('id, slug, code')))) as { id: string; slug: string; code: string }[]
  const rest = others.filter((s) => s.id !== exceptId)
  if (rest.some((s) => s.code.toLowerCase() === data.code.toLowerCase())) {
    return new RepositoryError('duplicate_code', `School code ${data.code} is already used by another school.`)
  }
  return new RepositoryError('duplicate_slug', `The link name "${data.slug}" is already used by another school.`, nextFreeSlug(data.slug, rest.map((s) => s.slug)))
}

const IMAGE_BUCKET = 'school-images'
/** Preview links for the school-image grid: long enough to look at the page, short enough not to be worth keeping. */
export const IMAGE_URL_SECONDS = 300
/** storage_path is read only to create preview links; it is never returned to the UI. */
const IMAGE_COLUMNS =
  'id, school_id, storage_path, original_name, mime_type, size_bytes, alt_text, is_primary, display_order, created_at, ' +
  'review_status, source, submitted_contact_person, submitted_contact_details, submission_note, reviewed_at'
interface ImageRow {
  id: string
  school_id: string
  storage_path: string
  original_name: string
  mime_type: SchoolImage['mimeType']
  size_bytes: number
  alt_text: string | null
  is_primary: boolean
  display_order: number
  created_at: string
  review_status: SchoolImageStatus
  source: 'admin' | 'public'
  submitted_contact_person: string | null
  submitted_contact_details: string | null
  submission_note: string | null
  reviewed_at: string | null
}
const toImage = (r: ImageRow, url: string): SchoolImage => ({
  id: r.id,
  schoolId: r.school_id,
  originalName: r.original_name,
  mimeType: r.mime_type,
  sizeBytes: Number(r.size_bytes),
  altText: r.alt_text ?? undefined,
  isPrimary: r.is_primary,
  displayOrder: r.display_order,
  createdAt: r.created_at,
  url,
  reviewStatus: r.review_status,
  source: r.source,
  submission: r.submitted_contact_person && r.submitted_contact_details
    ? { contactPerson: r.submitted_contact_person, contactDetails: r.submitted_contact_details, note: r.submission_note ?? undefined }
    : undefined,
  reviewedAt: r.reviewed_at ?? undefined,
})

const IMAGE_ERRORS = {
  byMessage: { duplicate_image: 'duplicate_image', invalid_image: 'invalid_input', image_not_uploaded: 'unknown', not_approved: 'invalid_status', primary_image: 'invalid_status' },
  unique: 'duplicate_image',
} as const

/** Storage reports an object that already exists (a non-overwriting upload to a taken name). */
const alreadyExists = (e: unknown) => {
  const x = (e ?? {}) as { statusCode?: string | number; message?: string; error?: string }
  return String(x.statusCode) === '409' || /already exists|duplicate/i.test(`${x.message ?? ''} ${x.error ?? ''}`)
}

/**
 * The ONE image-storing routine, shared by the administrator uploader and the public form: the file has already passed
 * inspectImage (type, size, signature, decode, checksum); it is uploaded without overwriting, then registered.
 *   - Administrator path: a random name; if registration fails the uploaded object is removed again (the orphan-only
 *     delete policy allows exactly that).
 *   - Public path: a content-named object (checksum), so a retry finds "already exists", which is our own object, and
 *     simply registers it again. Nothing is deleted: anonymous visitors have no delete permission.
 */
async function storeImage(
  c: Client,
  file: File,
  check: Extract<ImageCheck, { ok: true }>,
  { path, register, contentNamed }: { path: string; register: () => Promise<{ data: unknown; error: unknown }>; contentNamed: boolean },
): Promise<unknown> {
  const up = await guarded(() => c.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: check.type.mime, upsert: false, cacheControl: '3600' }))
  if (up.error && !(contentNamed && alreadyExists(up.error))) throw toRepositoryError(up.error)
  const reg = await guarded(register)
  if (reg.error) {
    if (!contentNamed) await guarded(() => c.storage.from(IMAGE_BUCKET).remove([path])).catch(() => undefined)
    throw toRepositoryError(reg.error, IMAGE_ERRORS)
  }
  return reg.data
}

async function checkedImage(file: File) {
  const check = await inspectImage(file)
  if (!check.ok) throw new RepositoryError('invalid_input', check.message, undefined, { file: check.message })
  return check
}

export function createSupabaseSchoolRepository(client: Client | null): SchoolRepository {
  return {
    async list({ search = '', status = 'all' } = {}) {
      const c = requireClient(client)
      let q = c.from('schools').select(SCHOOL_COLUMNS).order('name')
      if (status === 'active') q = q.eq('is_active', true)
      if (status === 'inactive') q = q.eq('is_active', false)
      const term = searchTerm(search)
      if (term) q = q.or(ilikeAny(['name', 'code'], term))
      const rows = unwrap(await guarded(() => Promise.resolve(q))) as SchoolRow[]
      return rows.map(toSchool)
    },

    async listActive() {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('list_active_schools')))) as { id: string; name: string }[]
      return rows.map((r) => ({ id: r.id, name: r.name }))
    },

    async getDetail(id) {
      const c = requireClient(client)
      const schoolId = requireId(id, 'school')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('schools').select(SCHOOL_COLUMNS).eq('id', schoolId).maybeSingle()))) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      const count = async (table: 'students' | 'orders' | 'uploaded_files') => {
        let q = c.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
        if (table === 'students') q = q.is('archived_at', null)
        const res = await guarded(() => Promise.resolve(q))
        if (res.error) throw toRepositoryError(res.error)
        return res.count ?? 0
      }
      const [studentCount, orderCount, fileCount] = await Promise.all([count('students'), count('orders'), count('uploaded_files')])
      return { school: toSchool(row), studentCount, orderCount, fileCount }
    },

    async resolveBySlug(slug) {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('resolve_school', { p_slug: slug })))) as
        { status: string; school_id: string | null; name: string | null; slug: string | null }[]
      const r = rows[0]
      if (r?.status === 'active' && r.school_id && r.name && r.slug) return { status: 'active', school: { id: r.school_id, name: r.name, slug: r.slug } }
      if (r?.status === 'inactive') return { status: 'inactive' }
      return { status: 'not_found' }
    },

    async create(input) {
      const c = requireClient(client)
      const data = clean(input)
      const res = await guarded(() => Promise.resolve(c.from('schools').insert(data).select(SCHOOL_COLUMNS).single()))
      if ((res.error as { code?: string } | null)?.code === '23505') throw await duplicateError(c, data)
      return toSchool(unwrap(res) as SchoolRow)
    },

    async update(id, input) {
      const c = requireClient(client)
      const schoolId = requireId(id, 'school')
      const data = clean(input)
      const res = await guarded(() => Promise.resolve(c.from('schools').update(data).eq('id', schoolId).select(SCHOOL_COLUMNS).maybeSingle()))
      if ((res.error as { code?: string } | null)?.code === '23505') throw await duplicateError(c, data, schoolId)
      const row = unwrap(res) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      return toSchool(row)
    },

    async listImages(schoolId) {
      const c = requireClient(client)
      const id = requireId(schoolId, 'school')
      const rows = unwrap(
        await guarded(() =>
          Promise.resolve(
            c.from('school_images').select(IMAGE_COLUMNS).eq('school_id', id).order('is_primary', { ascending: false }).order('display_order').order('created_at'),
          ),
        ),
      ) as ImageRow[]
      if (rows.length === 0) return []
      // Short-lived preview links for the administrator (the bucket is private). Not stored anywhere else.
      const signed = await guarded(() => c.storage.from(IMAGE_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), IMAGE_URL_SECONDS))
      if (signed.error) throw toRepositoryError(signed.error)
      const urls = new Map((signed.data ?? []).map((d) => [d.path, d.signedUrl]))
      return rows.map((r) => toImage(r, urls.get(r.storage_path) ?? ''))
    },

    async uploadImage(schoolId, file, { altText } = {}) {
      const c = requireClient(client)
      const id = requireId(schoolId, 'school')
      const check = await checkedImage(file)
      // A random object name inside the school's folder. The database re-checks the administrator, the school, the stored
      // type and size, and the shared duplicate rule (one record per school and checksum, whoever added it).
      const path = `schools/${id}/${crypto.randomUUID()}.${check.type.ext}`
      const data = await storeImage(c, file, check, {
        path,
        contentNamed: false,
        register: () => Promise.resolve(c.rpc('admin_register_school_image', { p_school_id: id, p_storage_path: path, p_original_name: file.name, p_sha256: check.sha256, p_alt_text: altText?.trim() || null })),
      })
      const r = (data as { image_id: string }[] | null)?.[0]
      if (!r) throw new RepositoryError('unknown', 'The image could not be confirmed. Please refresh the list.')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('school_images').select(IMAGE_COLUMNS).eq('id', r.image_id).maybeSingle()))) as ImageRow | null
      if (!row) throw new RepositoryError('unknown', 'The image could not be confirmed. Please refresh the list.')
      const signed = await guarded(() => c.storage.from(IMAGE_BUCKET).createSignedUrl(row.storage_path, IMAGE_URL_SECONDS))
      return toImage(row, signed.data?.signedUrl ?? '')
    },

    async submitImage(input, file) {
      const c = requireClient(client)
      const v = parseInput(schoolImageSubmissionSchema, { ...input, note: input.note ?? '' }, 'Please check the form.')
      const schoolId = v.schoolId
      const check = await checkedImage(file)
      const schools = unwrap(await guarded(() => Promise.resolve(c.rpc('list_active_schools')))) as { id: string }[]
      if (!schools.some((s) => s.id === schoolId)) throw new RepositoryError('school_unavailable', 'This school is not accepting submissions.')
      // Skip the upload entirely when the school already has this exact image (no object, no record).
      const present = unwrap(await guarded(() => Promise.resolve(c.rpc('school_image_already_present', { p_school_id: schoolId, p_sha256: check.sha256 })))) as boolean
      if (present) return 'already_present'
      const path = `submissions/${schoolId}/${check.sha256}.${check.type.ext}`
      const data = await storeImage(c, file, check, {
        path,
        contentNamed: true,
        register: () =>
          Promise.resolve(
            c.rpc('submit_school_image', {
              p_school_id: schoolId,
              p_contact_person: v.contactPerson,
              p_contact_details: normalizeContact(v.contactDetails),
              p_storage_path: path,
              p_original_name: file.name,
              p_sha256: check.sha256,
              p_note: v.note || null,
            }),
          ),
      })
      const status = (data as { status: string }[] | null)?.[0]?.status
      if (status !== 'submitted' && status !== 'already_present') throw new RepositoryError('unknown', 'The image could not be confirmed. Please try again.')
      return status
    },

    async setPrimaryImage(imageId) {
      const c = requireClient(client)
      unwrap(await guarded(() => Promise.resolve(c.rpc('admin_set_primary_school_image', { p_image_id: requireId(imageId, 'image') }))), IMAGE_ERRORS)
    },

    async reviewImage(imageId, decision) {
      const c = requireClient(client)
      if (!['pending', 'approved', 'rejected'].includes(decision)) throw new RepositoryError('invalid_status', 'That is not a supported decision.')
      unwrap(await guarded(() => Promise.resolve(c.rpc('admin_review_school_image', { p_image_id: requireId(imageId, 'image'), p_decision: decision }))), IMAGE_ERRORS)
    },

    async pendingImageCounts() {
      const c = requireClient(client)
      const rows = unwrap(
        await guarded(() => Promise.resolve(c.from('school_images').select('school_id, school:schools(name)').eq('review_status', 'pending').limit(2000))),
      ) as { school_id: string; school: { name: string } | null }[]
      const by = new Map<string, { schoolId: string; schoolName: string; count: number }>()
      for (const r of rows) {
        const e = by.get(r.school_id) ?? { schoolId: r.school_id, schoolName: r.school?.name ?? 'Unknown school', count: 0 }
        e.count++
        by.set(r.school_id, e)
      }
      return [...by.values()].sort((a, b) => b.count - a.count || a.schoolName.localeCompare(b.schoolName))
    },

    async setActive(id, isActive) {
      const c = requireClient(client)
      if (!isUuid(id)) throw new RepositoryError('not_found', 'School not found.')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('schools').update({ is_active: isActive }).eq('id', id).select(SCHOOL_COLUMNS).maybeSingle()))) as SchoolRow | null
      if (!row) throw new RepositoryError('not_found', 'School not found.')
      return toSchool(row)
    },
  }
}
