import { delay } from '@/lib/delay'
import { localDateISO } from '@/lib/format'
import { FILE_REVIEW_STATUSES, type FileReviewStatus, type ID, type UploadedFile, type UploadedFileType } from '@/types'
import { ACCEPTED_EXTENSIONS, isAcceptedExtension } from '@/validations/upload'
import { RepositoryError } from '../errors'
import { checkSubmission } from '../fileSubmission'
import type { AdminFile, AdminFileDetail, FileRepository } from '../types'
import { db, pad5 } from './db'

/**
 * Prototype hook for testing the error state: upload any file whose name contains "FAIL"
 * (e.g. students-FAIL.xlsx). The mock fails part-way through, like a dropped connection.
 * A real repository would reject the same way on a storage/network error.
 */
export const MOCK_FAILURE_FILENAME_TOKEN = 'FAIL'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const NOTES_MAX = 1000

/** Joins the school by id (falling back to the stored display name) and drops the private storage path. */
function toAdminFile(f: UploadedFile): AdminFile {
  const { storagePath: _storagePath, customer, ...rest } = f
  const school = f.schoolId ? db.schools.find((s) => s.id === f.schoolId) : undefined
  return { ...rest, schoolName: school?.name ?? customer }
}

const toDetail = (f: UploadedFile): AdminFileDetail => ({
  ...toAdminFile(f),
  reviewHistory: db.fileReviews.filter((h) => h.fileId === f.id).map(({ fileId: _fileId, ...h }) => h),
})

function findById(id: ID): UploadedFile {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', 'A file id is required.')
  const file = db.files.find((f) => f.id === id)
  if (!file) throw new RepositoryError('not_found', 'File not found.')
  return file
}

const isReviewStatus = (v: unknown): v is FileReviewStatus => typeof v === 'string' && (FILE_REVIEW_STATUSES as readonly string[]).includes(v)

export const mockFileRepository: FileRepository = {
  async submit(input, { onProgress }) {
    // Same checks as the live repository; the school is re-checked, never trusted from the form.
    const clean = await checkSubmission(input)
    const school = db.schools.find((s) => s.id === clean.schoolId)
    if (!school || !school.isActive) throw new RepositoryError('school_unavailable', 'This school is not accepting submissions.')
    const shouldFail = input.file.name.toUpperCase().includes(MOCK_FAILURE_FILENAME_TOKEN)

    // Simulated transfer: steady, slightly uneven progress over a couple of seconds.
    let percent = 0
    onProgress(0)
    while (percent < 100) {
      await delay(150)
      percent = Math.min(100, percent + 3 + Math.floor(Math.random() * 7))
      if (shouldFail && percent >= 55) throw new Error('Mock upload failure')
      onProgress(percent)
    }
    await delay(250) // "processing" after the last byte

    const now = new Date()
    const referenceNo = `FILE-${now.getFullYear()}-${pad5(db.files.length + 1)}`
    const record: UploadedFile = {
      id: crypto.randomUUID(),
      referenceNo,
      originalName: input.file.name,
      storagePath: `incoming/${crypto.randomUUID()}.${clean.ext}`,
      type: clean.ext as UploadedFileType,
      sizeBytes: input.file.size,
      uploadedAt: now.toISOString(),
      schoolId: school.id,
      storageState: 'metadata_only', // the file's bytes are not kept in the prototype
      contactPerson: clean.contactPerson,
      contactDetails: clean.contactDetails,
      category: clean.category,
      description: clean.description,
      instructions: clean.instructions ?? undefined,
      reviewStatus: 'pending', // always: only the administrator decides
    }
    db.files.push(record)

    return {
      referenceNo: record.referenceNo,
      originalName: record.originalName,
      type: record.type,
      sizeBytes: record.sizeBytes,
      uploadedAt: record.uploadedAt,
      schoolName: school.name,
    }
  },

  async list({ search = '', schoolId, type = 'all', reviewStatus = 'all', from, to, page = 1, pageSize = 10 } = {}) {
    await delay(250)
    // Validated here too: this is what a real backend must enforce independently of the UI.
    if (type !== 'all' && !isAcceptedExtension(type)) throw new RepositoryError('invalid_filter', 'That file type is not supported.')
    if (reviewStatus !== 'all' && !isReviewStatus(reviewStatus)) throw new RepositoryError('invalid_filter', 'That review status is not supported.')
    for (const d of [from, to]) if (d && (!DATE_ONLY.test(d) || Number.isNaN(Date.parse(d)))) throw new RepositoryError('invalid_filter', 'Dates must be real calendar dates.')
    if (from && to && from > to) throw new RepositoryError('invalid_filter', 'The "from" date must not be after the "to" date.')

    const q = search.trim().toLowerCase()
    const matches = db.files
      .filter((f) => type === 'all' || f.type === type)
      .filter((f) => reviewStatus === 'all' || f.reviewStatus === reviewStatus)
      .filter((f) => !schoolId || (schoolId === 'none' ? !f.schoolId : f.schoolId === schoolId))
      .filter((f) => {
        if (!from && !to) return true
        const day = localDateISO(f.uploadedAt)
        return (!from || day >= from) && (!to || day <= to)
      })
      .filter((f) => !q || f.originalName.toLowerCase().includes(q) || f.referenceNo.toLowerCase().includes(q) || (f.contactPerson ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || b.referenceNo.localeCompare(a.referenceNo))

    const total = matches.length
    const size = Math.max(1, pageSize)
    const totalPages = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, page), totalPages)
    const byType = Object.fromEntries(ACCEPTED_EXTENSIONS.map((t) => [t, db.files.filter((f) => f.type === t).length])) as Record<UploadedFileType, number>
    const byReview = Object.fromEntries(FILE_REVIEW_STATUSES.map((s) => [s, db.files.filter((f) => f.reviewStatus === s).length])) as Record<FileReviewStatus, number>
    return {
      items: matches.slice((current - 1) * size, current * size).map(toAdminFile),
      total,
      page: current,
      pageSize: size,
      totalPages,
      counts: { total: db.files.length, totalBytes: db.files.reduce((n, f) => n + f.sizeBytes, 0), byType, byReview },
    }
  },

  async getDetail(id: ID) {
    await delay(250)
    return toDetail(findById(id))
  },

  async review(id, status, notes) {
    await delay(400)
    const file = findById(id)
    if (!isReviewStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported review decision.')
    const cleanNotes = (notes ?? '').trim() || undefined
    if (cleanNotes && cleanNotes.length > NOTES_MAX) {
      throw new RepositoryError('invalid_input', `Notes must be ${NOTES_MAX} characters or fewer.`, undefined, { notes: `Notes must be ${NOTES_MAX} characters or fewer.` })
    }
    if (file.reviewStatus === status && file.reviewNotes === cleanNotes) throw new RepositoryError('no_change', 'Nothing changed: the decision and notes are the same.')
    const at = new Date().toISOString()
    file.reviewStatus = status
    file.reviewNotes = cleanNotes
    file.reviewedAt = status === 'pending' ? undefined : at
    db.fileReviews.push({ fileId: file.id, status, notes: cleanNotes, at })
    return toDetail(file)
  },

  async getDownloadUrl(id: ID) {
    await mockFileRepository.getDetail(id) // invalid_id / not_found first
    // Demo data keeps metadata only, so there are never bytes to download.
    throw new RepositoryError('not_stored', 'Only the file details were recorded for this upload; there is no stored copy to download.')
  },
}
