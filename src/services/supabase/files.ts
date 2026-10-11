import type { UploadedFileType } from '@/types'
import { getExtension, isAcceptedExtension, validateUploadFile } from '@/validations/upload'
import { RepositoryError } from '../errors'
import type { FileRepository } from '../types'
import { FILE_COLUMNS, toAdminFile, type FileRow } from './rows'
import { fetchSummary } from './summary'
import { fetchPage, guarded, ilikeAny, localDayBounds, requireClient, requireId, searchTerm, toRepositoryError, unwrap, type Client } from './shared'

const BUCKET = 'school-uploads'
/** A download link is created on click and used straight away, so it only needs to live briefly. */
export const DOWNLOAD_URL_SECONDS = 60

/** The bucket only accepts these types; the type is chosen from the (validated) extension, not from the browser's guess. */
const CONTENT_TYPE: Record<UploadedFileType, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
}

export function createSupabaseFileRepository(client: Client | null): FileRepository {
  return {
    async upload(file, { onProgress }) {
      const c = requireClient(client)
      const problem = validateUploadFile(file)
      if (problem) throw new RepositoryError('invalid_input', problem)
      const ext = getExtension(file.name)
      if (!isAcceptedExtension(ext)) throw new RepositoryError('invalid_input', 'Unsupported file type.')
      // supabase-js does not report byte progress, so progress moves in coarse steps around the real work.
      onProgress(5)
      // A random object name in the private bucket. Anonymous visitors may only insert there (never read, list or replace).
      const path = `incoming/${crypto.randomUUID()}.${ext}`
      const upload = await guarded(() => c.storage.from(BUCKET).upload(path, file, { contentType: CONTENT_TYPE[ext], upsert: false, cacheControl: '0' }))
      if (upload.error) throw toRepositoryError(upload.error)
      onProgress(90)
      // The database checks the object really exists, reads its size from storage, and creates the record.
      const rows = unwrap(
        await guarded(() => Promise.resolve(c.rpc('submit_file_upload', { p_storage_path: path, p_original_name: file.name }))),
        { byMessage: { invalid_file: 'invalid_input', file_not_uploaded: 'invalid_input' } },
      ) as { reference_no: string; original_name: string; file_type: UploadedFileType; size_bytes: number; uploaded_at: string }[]
      const r = rows[0]
      if (!r) throw new RepositoryError('unknown', 'The upload could not be confirmed. Please try again.')
      onProgress(100)
      return { referenceNo: r.reference_no, originalName: r.original_name, type: r.file_type, sizeBytes: Number(r.size_bytes), uploadedAt: r.uploaded_at }
    },

    async list({ search, schoolId, type = 'all', from, to, page, pageSize } = {}) {
      if (type !== 'all' && !isAcceptedExtension(type)) throw new RepositoryError('invalid_filter', 'That file type is not supported.')
      const dates = localDayBounds(from, to)
      const c = requireClient(client)
      const query = () => {
        let q = c.from('uploaded_files').select(FILE_COLUMNS, { count: 'exact' })
        if (type !== 'all') q = q.eq('file_type', type)
        if (schoolId === 'none') q = q.is('school_id', null)
        else if (schoolId) q = q.eq('school_id', schoolId)
        if (dates.gte) q = q.gte('uploaded_at', dates.gte)
        if (dates.lt) q = q.lt('uploaded_at', dates.lt)
        const term = searchTerm(search)
        if (term) q = q.or(ilikeAny(['original_name', 'reference_no'], term))
        return q.order('uploaded_at', { ascending: false }).order('reference_no', { ascending: false })
      }
      const [result, summary] = await Promise.all([fetchPage<FileRow>((f, t) => query().range(f, t), page, pageSize), fetchSummary(c)])
      return {
        ...result,
        items: result.items.map(toAdminFile),
        counts: { total: summary.files.total, totalBytes: Number(summary.files.totalBytes), byType: summary.files.byType },
      }
    },

    async getDetail(id) {
      const c = requireClient(client)
      const fileId = requireId(id, 'file')
      const row = unwrap(await guarded(() => Promise.resolve(c.from('uploaded_files').select(FILE_COLUMNS).eq('id', fileId).maybeSingle()))) as FileRow | null
      if (!row) throw new RepositoryError('not_found', 'File not found.')
      return toAdminFile(row)
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
      const signed = await guarded(() => c.storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_URL_SECONDS, { download: row.original_name }))
      if (signed.error || !signed.data?.signedUrl) throw toRepositoryError(signed.error ?? {})
      return signed.data.signedUrl
    },
  }
}
