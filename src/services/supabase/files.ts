import { FILE_REVIEW_STATUSES, type FileReviewStatus, type UploadedFileType } from '@/types'
import { isAcceptedExtension } from '@/validations/upload'
import { RepositoryError } from '../errors'
import { checkSubmission } from '../fileSubmission'
import type { AdminFileDetail, FileRepository } from '../types'
import { FILE_COLUMNS, toAdminFile, type FileRow } from './rows'
import { fetchSummary } from './summary'
import { fetchPage, guarded, ilikeAny, localDayBounds, requireClient, requireId, searchTerm, toRepositoryError, unwrap, type Client } from './shared'

const BUCKET = 'school-uploads'
/** A download link is created on click and used straight away, so it only needs to live briefly. */
export const DOWNLOAD_URL_SECONDS = 60
const NOTES_MAX = 1000

/** The bucket only accepts these types; the type is chosen from the (validated) extension, not from the browser's guess. */
const CONTENT_TYPE: Record<UploadedFileType, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
}

const SUBMIT_ERRORS = { invalid_file: 'invalid_input', invalid_input: 'invalid_input', file_not_uploaded: 'unknown' } as const
const isReviewStatus = (v: unknown): v is FileReviewStatus => typeof v === 'string' && (FILE_REVIEW_STATUSES as readonly string[]).includes(v)

/**
 * Objects uploaded in this page session whose registration did not complete, keyed by the File the visitor chose.
 * Anonymous visitors can never delete an object (the bucket is insert-only for them, deliberately), so a failed
 * registration cannot be cleaned up from the browser. A retry with the SAME file re-registers the object already uploaded
 * instead of uploading another copy. Memory only: never written to browser storage.
 */
const unregistered = new WeakMap<File, string>()

export function createSupabaseFileRepository(client: Client | null): FileRepository {
  async function readDetail(c: Client, id: string): Promise<AdminFileDetail> {
    const [fileRes, historyRes] = await Promise.all([
      guarded(() => Promise.resolve(c.from('uploaded_files').select(FILE_COLUMNS).eq('id', id).maybeSingle())),
      guarded(() => Promise.resolve(c.from('uploaded_file_reviews').select('review_status, review_notes, reviewed_at').eq('file_id', id).order('reviewed_at').order('id'))),
    ])
    const row = unwrap(fileRes) as FileRow | null
    if (!row) throw new RepositoryError('not_found', 'File not found.')
    const history = unwrap(historyRes) as { review_status: FileReviewStatus; review_notes: string | null; reviewed_at: string }[]
    return { ...toAdminFile(row), reviewHistory: history.map((h) => ({ status: h.review_status, notes: h.review_notes ?? undefined, at: h.reviewed_at })) }
  }

  return {
    async submit(input, { onProgress }) {
      const c = requireClient(client)
      // 1. Every field and the file (extension, size, type, first bytes) are checked before anything is sent.
      const clean = await checkSubmission(input)
      // 2. The school must be one the public may submit to (re-checked by the database too). Checking first avoids
      //    leaving an upload behind for a school that would be refused anyway.
      const schools = unwrap(await guarded(() => Promise.resolve(c.rpc('list_active_schools')))) as { id: string }[]
      if (!schools.some((s) => s.id === clean.schoolId)) throw new RepositoryError('school_unavailable', 'This school is not accepting submissions.')
      onProgress(5)

      // 3. Upload into the PRIVATE bucket under a random name (anonymous visitors may only insert there).
      let path = unregistered.get(input.file)
      if (!path) {
        path = `incoming/${crypto.randomUUID()}.${clean.ext}`
        const upload = await guarded(() => c.storage.from(BUCKET).upload(path as string, input.file, { contentType: CONTENT_TYPE[clean.ext], upsert: false, cacheControl: '0' }))
        if (upload.error) throw toRepositoryError(upload.error)
        unregistered.set(input.file, path)
      }
      onProgress(90)

      // 4. Register: the database re-validates every field and the stored object, and always stores 'pending'.
      const rows = unwrap(
        await guarded(() =>
          Promise.resolve(
            c.rpc('submit_school_file', {
              p_school_id: clean.schoolId,
              p_contact_person: clean.contactPerson,
              p_contact_details: clean.contactDetails,
              p_category: clean.category,
              p_description: clean.description,
              p_storage_path: path,
              p_original_name: input.file.name,
              p_instructions: clean.instructions,
            }),
          ),
        ),
        { byMessage: SUBMIT_ERRORS, unique: 'unknown' },
      ) as { reference_no: string; original_name: string; file_type: UploadedFileType; size_bytes: number; uploaded_at: string; school_name: string }[]
      const r = rows[0]
      if (!r) throw new RepositoryError('unknown', 'The submission could not be confirmed. Please try again.')
      unregistered.delete(input.file)
      onProgress(100)
      return { referenceNo: r.reference_no, originalName: r.original_name, type: r.file_type, sizeBytes: Number(r.size_bytes), uploadedAt: r.uploaded_at, schoolName: r.school_name }
    },

    async list({ search, schoolId, type = 'all', reviewStatus = 'all', from, to, page, pageSize } = {}) {
      if (type !== 'all' && !isAcceptedExtension(type)) throw new RepositoryError('invalid_filter', 'That file type is not supported.')
      if (reviewStatus !== 'all' && !isReviewStatus(reviewStatus)) throw new RepositoryError('invalid_filter', 'That review status is not supported.')
      const dates = localDayBounds(from, to)
      const c = requireClient(client)
      const query = () => {
        let q = c.from('uploaded_files').select(FILE_COLUMNS, { count: 'exact' })
        if (type !== 'all') q = q.eq('file_type', type)
        if (reviewStatus !== 'all') q = q.eq('review_status', reviewStatus)
        if (schoolId === 'none') q = q.is('school_id', null)
        else if (schoolId) q = q.eq('school_id', schoolId)
        if (dates.gte) q = q.gte('uploaded_at', dates.gte)
        if (dates.lt) q = q.lt('uploaded_at', dates.lt)
        const term = searchTerm(search)
        if (term) q = q.or(ilikeAny(['original_name', 'reference_no', 'contact_person'], term))
        return q.order('uploaded_at', { ascending: false }).order('reference_no', { ascending: false })
      }
      const [result, summary] = await Promise.all([fetchPage<FileRow>((f, t) => query().range(f, t), page, pageSize), fetchSummary(c)])
      return {
        ...result,
        items: result.items.map(toAdminFile),
        counts: { total: summary.files.total, totalBytes: Number(summary.files.totalBytes), byType: summary.files.byType, byReview: summary.files.byReview },
      }
    },

    async getDetail(id) {
      const c = requireClient(client)
      return readDetail(c, requireId(id, 'file'))
    },

    async review(id, status, notes) {
      const c = requireClient(client)
      const fileId = requireId(id, 'file')
      if (!isReviewStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported review decision.')
      const cleanNotes = (notes ?? '').trim()
      if (cleanNotes.length > NOTES_MAX) {
        throw new RepositoryError('invalid_input', `Notes must be ${NOTES_MAX} characters or fewer.`, undefined, { notes: `Notes must be ${NOTES_MAX} characters or fewer.` })
      }
      unwrap(await guarded(() => Promise.resolve(c.rpc('admin_review_file', { p_file_id: fileId, p_status: status, p_notes: cleanNotes || null }))))
      return readDetail(c, fileId)
    },

    async getDownloadUrl(id) {
      const c = requireClient(client)
      const fileId = requireId(id, 'file')
      const row = unwrap(
        await guarded(() => Promise.resolve(c.from('uploaded_files').select('storage_state, storage_bucket, storage_path, original_name').eq('id', fileId).maybeSingle())),
      ) as { storage_state: string; storage_bucket: string | null; storage_path: string | null; original_name: string } | null
      if (!row) throw new RepositoryError('not_found', 'File not found.')
      if (row.storage_state !== 'stored' || row.storage_bucket !== BUCKET || !row.storage_path) {
        throw new RepositoryError('not_stored', 'Only the file details were recorded for this upload; there is no stored copy to download.')
      }
      const path = row.storage_path
      // `download` makes the link an attachment: the browser saves the file, it never opens it in the page.
      const signed = await guarded(() => c.storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_URL_SECONDS, { download: row.original_name }))
      if (signed.error || !signed.data?.signedUrl) throw toRepositoryError(signed.error ?? {})
      return signed.data.signedUrl
    },
  }
}
