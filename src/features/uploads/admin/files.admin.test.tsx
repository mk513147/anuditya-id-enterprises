import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import type { AdminFile } from '@/services/types'
import { FileDetails } from './FileDetailDialog'
import { FileFilters } from './FileFilters'
import { fileColumns, fileRowActions } from './fileColumns'
import { fileStatGroups } from './fileStats'
import { toFileListParams } from './useFileFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const file = (over: Partial<AdminFile> = {}): AdminFile => ({
  id: 'fil-1', referenceNo: 'FILE-2026-00001', originalName: 'StMarys_Students_2026.xlsx', type: 'xlsx', sizeBytes: 254_976,
  uploadedAt: '2026-06-09T10:15:00.000Z', schoolId: 'sch-stmarys', schoolName: "St. Mary's School", ...over,
})
const noop = () => {}

describe('admin file table', () => {
  const rows = [file(), file({ id: 'fil-5', referenceNo: 'FILE-2026-00005', originalName: 'public.csv', type: 'csv', sizeBytes: 2048, schoolId: undefined, schoolName: undefined })]
  const html = renderToStaticMarkup(<DataTable caption="Uploaded files" columns={fileColumns(noop)} rows={rows} rowKey={(f) => f.id} actions={fileRowActions(noop)} />)

  it('renders name, reference, format, size, school and upload date', () => {
    for (const t of ['StMarys_Students_2026.xlsx', 'FILE-2026-00001', '.xlsx', '249 KB', "St. Mary&#x27;s School", '9 Jun 2026', 'public.csv', '.csv', '2 KB']) {
      expect(html, t).toContain(t)
    }
  })

  it('says "No school recorded" instead of inventing a school', () => {
    expect(count(html, 'No school recorded')).toBe(2) // table + phone card
    expect(html).not.toMatch(/Unknown school/)
  })

  it('has no processing-status column and no download control (neither exists in the data)', () => {
    expect(html).not.toMatch(/Processing|Download/i)
    expect(count(html, '<th ')).toBe(fileColumns(noop).length + 1)
  })

  it('has an accessible caption, a phone list and a labelled details action per file', () => {
    expect(html).toContain('<caption class="sr-only">Uploaded files</caption>')
    expect(html).toContain('<ul aria-label="Uploaded files"')
    expect(html).toContain('aria-label="View details of public.csv"')
  })
})

describe('file filters', () => {
  const base = { filters: { q: '', school: '', type: 'all' as const, from: '', to: '', page: 1 }, update: noop, clear: noop, schools: [], hasActiveFilters: false }

  it('offers file-name search, school (incl. none), type and upload-date filters, all labelled; no status filter', () => {
    const html = renderToStaticMarkup(<FileFilters {...base} />)
    for (const l of ['Search by file name', 'School', 'File type', 'Uploaded from', 'Uploaded to']) expect(html, l).toContain(`>${l}</label>`)
    expect(html).toContain('No school recorded')
    for (const t of ['xlsx', 'xls', 'csv']) expect(html).toContain(`<option value="${t}"`)
    expect(html).not.toMatch(/Status/)
  })

  it('shows removable chips and Clear all when filters are active', () => {
    const html = renderToStaticMarkup(
      <FileFilters {...base} hasActiveFilters filters={{ q: 'class', school: 'none', type: 'csv', from: '2026-09-01', to: '', page: 1 }} />,
    )
    for (const t of ['Search: “class”', 'School: No school recorded', 'Type: .csv', 'From: 1 Sept 2026', 'Clear all filters']) expect(html, t).toContain(t)
    expect(count(html, 'aria-label="Remove filter')).toBe(4)
  })

  it('turns URL filters into repository params, omitting empty ones', () => {
    expect(toFileListParams({ q: '', school: '', type: 'all', from: '', to: '', page: 1 })).toEqual({ search: undefined, schoolId: undefined, type: 'all', from: undefined, to: undefined, page: 1, pageSize: 10 })
    expect(toFileListParams({ q: 'a', school: 'none', type: 'xls', from: '2026-01-01', to: '2026-02-01', page: 2 }, 5)).toEqual({ search: 'a', schoolId: 'none', type: 'xls', from: '2026-01-01', to: '2026-02-01', page: 2, pageSize: 5 })
  })
})

describe('file details', () => {
  it('shows every field the repository provides', () => {
    const html = renderToStaticMarkup(<FileDetails file={file()} />)
    for (const t of ['StMarys_Students_2026.xlsx', 'FILE-2026-00001', 'Excel Spreadsheet (.xlsx)', '249 KB', '2,54,976 bytes', '9 Jun 2026', "St. Mary&#x27;s School"]) expect(html, t).toContain(t)
  })

  it('explains that contents are unavailable and offers no download', () => {
    const html = renderToStaticMarkup(<FileDetails file={file()} />)
    expect(html).toContain('File contents are not available.')
    expect(html).toContain('cannot be opened or downloaded')
    expect(html).toContain('reset when the page is reloaded')
    expect(html).not.toMatch(/<a |<button|download=/)
  })

  it('never shows a storage path, and explains a missing school', () => {
    const html = renderToStaticMarkup(<FileDetails file={file({ schoolId: undefined, schoolName: undefined })} />)
    expect(html).not.toMatch(/uploads\/|storagePath/)
    expect(html).toContain('No school recorded')
    expect(html).toContain('does not ask for a school')
  })
})

describe('file stats', () => {
  it('groups counts by family and keeps the total size', () => {
    expect(fileStatGroups({ total: 9, totalBytes: 1234, byType: { xlsx: 3, xls: 2, csv: 4 } })).toEqual({ total: 9, excel: 5, csv: 4, totalBytes: 1234 })
  })
})
