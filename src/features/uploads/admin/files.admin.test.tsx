import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import { FileReviewBadge } from '@/components/admin/StatusBadge'
import type { AdminFile, AdminFileDetail } from '@/services/types'
import { FileDetails } from './FileDetailDialog'
import { FileFilters } from './FileFilters'
import { descriptionPreview, fileColumns, fileRowActions } from './fileColumns'
import { fileStatGroups } from './fileStats'
import { toFileListParams, type FileFilters as Filters } from './useFileFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const file = (over: Partial<AdminFileDetail> = {}): AdminFileDetail => ({
  id: 'fil-1', referenceNo: 'FILE-2026-00001', originalName: 'StMarys_Students_2026.xlsx', type: 'xlsx', sizeBytes: 254_976,
  uploadedAt: '2026-06-09T10:15:00.000Z', schoolId: 'sch-stmarys', schoolName: "St. Mary's School", storageState: 'metadata_only',
  contactPerson: 'Asha Teacher', contactDetails: '9000000001', category: 'student_data',
  description: 'Student list for the 2026-27 session, Class 10, for ID card printing. Includes sections A to D.',
  instructions: 'Needed by Friday.', reviewStatus: 'pending', reviewHistory: [], ...over,
})
const legacy = (): AdminFile => ({
  id: 'fil-5', referenceNo: 'FILE-2026-00005', originalName: 'public.csv', type: 'csv', sizeBytes: 2048, uploadedAt: '2026-06-09T10:15:00.000Z',
  storageState: 'metadata_only', reviewStatus: 'approved',
})
const noop = () => {}

describe('admin submissions table', () => {
  const html = renderToStaticMarkup(<DataTable caption="Uploaded files" columns={fileColumns(noop)} rows={[file(), legacy()]} rowKey={(f) => f.id} actions={fileRowActions(noop)} />)

  it('shows school, contact person, submission date, category, file name, review status and a description preview', () => {
    for (const t of ['StMarys_Students_2026.xlsx', 'FILE-2026-00001', '249 KB', "St. Mary&#x27;s School", 'Asha Teacher', '9 Jun 2026', 'Student data / student list', 'Pending review', 'Approved', 'Student list for the 2026-27 session']) {
      expect(html, t).toContain(t)
    }
    for (const h of ['Submission', 'School', 'Contact person', 'Category', 'Review', 'Submitted']) expect(html, h).toContain(`>${h}</th>`)
  })

  it('never puts contact details, notes or instructions in the list', () => {
    expect(html).not.toContain('9000000001')
    expect(html).not.toContain('Needed by Friday')
  })

  it('says "No school recorded" for older uploads instead of inventing a school', () => {
    expect(count(html, 'No school recorded')).toBe(2) // table + phone card
    expect(html).not.toMatch(/Unknown school/)
  })

  it('has an accessible caption, a phone list and a labelled review action per file', () => {
    expect(html).toContain('<caption class="sr-only">Uploaded files</caption>')
    expect(html).toContain('<ul aria-label="Uploaded files"')
    expect(html).toContain('aria-label="Review public.csv"')
  })

  it('previews long descriptions on one line', () => {
    expect(descriptionPreview('a\n  b   c')).toBe('a b c')
    expect(descriptionPreview('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`)
    expect(descriptionPreview(undefined)).toBe('')
  })
})

describe('file filters', () => {
  const none: Filters = { q: '', school: '', type: 'all', review: 'all', from: '', to: '', page: 1 }
  const base = { filters: none, update: noop, clear: noop, schools: [], hasActiveFilters: false }

  it('offers search, school (incl. none), review status, type and upload-date filters, all labelled', () => {
    const html = renderToStaticMarkup(<FileFilters {...base} />)
    for (const l of ['Search', 'School', 'Review status', 'File type', 'Uploaded from', 'Uploaded to']) expect(html, l).toContain(`>${l}</label>`)
    expect(html).toContain('No school recorded')
    for (const t of ['xlsx', 'xls', 'csv', 'pending', 'approved', 'rejected', 'corrections_required']) expect(html).toContain(`<option value="${t}"`)
  })

  it('shows removable chips and Clear all when filters are active', () => {
    const html = renderToStaticMarkup(<FileFilters {...base} hasActiveFilters filters={{ ...none, q: 'class', school: 'none', type: 'csv', review: 'pending', from: '2026-09-01' }} />)
    for (const t of ['Search: “class”', 'School: No school recorded', 'Review: Pending review', 'Type: .csv', 'From: 1 Sept 2026', 'Clear all filters']) expect(html, t).toContain(t)
    expect(count(html, 'aria-label="Remove filter')).toBe(5)
  })

  it('turns URL filters into repository params, omitting empty ones', () => {
    expect(toFileListParams(none)).toEqual({ search: undefined, schoolId: undefined, type: 'all', reviewStatus: 'all', from: undefined, to: undefined, page: 1, pageSize: 10 })
    expect(toFileListParams({ q: 'a', school: 'none', type: 'xls', review: 'rejected', from: '2026-01-01', to: '2026-02-01', page: 2 }, 5)).toEqual({
      search: 'a', schoolId: 'none', type: 'xls', reviewStatus: 'rejected', from: '2026-01-01', to: '2026-02-01', page: 2, pageSize: 5,
    })
  })
})

describe('submission details', () => {
  it('shows the full submission and file metadata', () => {
    const html = renderToStaticMarkup(<FileDetails file={file()} />)
    for (const t of ['StMarys_Students_2026.xlsx', 'FILE-2026-00001', 'Excel Spreadsheet (.xlsx)', '249 KB', '2,54,976 bytes', '9 Jun 2026', "St. Mary&#x27;s School",
      'Asha Teacher', 'href="tel:+919000000001"', 'Student data / student list', 'Includes sections A to D.', 'Needed by Friday.']) expect(html, t).toContain(t)
  })

  it('links an email contact with mailto and marks older uploads as having no details', () => {
    expect(renderToStaticMarkup(<FileDetails file={file({ contactDetails: 'office@example.invalid' })} />)).toContain('href="mailto:office@example.invalid"')
    const html = renderToStaticMarkup(<FileDetails file={{ ...legacy(), reviewHistory: [] }} />)
    expect(html).toContain('uploaded before the submission form collected these details')
    expect(html).toContain('No school recorded')
  })

  it('explains that contents are unavailable for a metadata-only record and offers no download', () => {
    const html = renderToStaticMarkup(<FileDetails file={file()} download={<button type="button">Download</button>} />)
    expect(html).toContain('File contents are not available.')
    expect(html).not.toContain('<button type="button">Download</button>')
  })

  it('shows the download and review slots for a stored file', () => {
    const html = renderToStaticMarkup(<FileDetails file={file({ storageState: 'stored' })} download={<button type="button">Download</button>} review={<p>REVIEW-SLOT</p>} />)
    expect(html).toContain('<button type="button">Download</button>')
    expect(html).toContain('REVIEW-SLOT')
    expect(html).not.toContain('File contents are not available.')
  })

  it('lists the review history, newest first, with notes', () => {
    const html = renderToStaticMarkup(<FileDetails file={file({ reviewHistory: [
      { status: 'corrections_required', notes: 'Class 5 B missing', at: '2026-06-10T10:00:00.000Z' },
      { status: 'approved', at: '2026-06-12T10:00:00.000Z' },
    ] })} />)
    expect(html).toContain('Review history')
    expect(html.indexOf('Approved')).toBeLessThan(html.indexOf('Corrections required'))
    expect(html).toContain('Class 5 B missing')
  })

  it('never shows a storage path', () => {
    expect(renderToStaticMarkup(<FileDetails file={file()} />)).not.toMatch(/incoming\/|uploads\/|storagePath/)
  })
})

describe('review badge and stats', () => {
  it.each([
    ['pending', 'Pending review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['corrections_required', 'Corrections required'],
  ] as const)('%s shows text, not just colour', (status, text) => {
    expect(renderToStaticMarkup(<FileReviewBadge status={status} />)).toContain(text)
  })

  it('groups counts by family and by review state', () => {
    expect(fileStatGroups({ total: 9, totalBytes: 1234, byType: { xlsx: 3, xls: 2, csv: 4 }, byReview: { pending: 4, approved: 3, rejected: 1, corrections_required: 1 } })).toEqual({
      total: 9, excel: 5, csv: 4, totalBytes: 1234, pending: 4, corrections: 1, approved: 3, rejected: 1,
    })
  })
})
