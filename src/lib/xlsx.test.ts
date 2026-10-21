import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { STUDENT_EXPORT_COLUMNS, studentExportFilename, studentsWorkbook } from '@/features/students/admin/studentExport'
import type { AdminStudent } from '@/services/types'
import { buildWorkbook, cellValue, sheetName, workbookBlob, XLSX_MIME, type XlsxColumn } from './xlsx'

type Row = { ref: string; name: string; mobile: string; dob?: string; at?: string; n?: number }
const COLUMNS: XlsxColumn<Row>[] = [
  { header: 'Reference No', value: (r) => r.ref },
  { header: 'Name', value: (r) => r.name },
  { header: 'Mobile', value: (r) => r.mobile },
  { header: 'Date of birth', value: (r) => r.dob, type: 'date' },
  { header: 'Submitted at (IST)', value: (r) => r.at, type: 'datetime' },
  { header: 'Count', value: (r) => r.n, type: 'number' },
]
const ROWS: Row[] = [
  { ref: '00123', name: '=HYPERLINK("http://evil.example","click")', mobile: '9000000001', dob: '2012-04-09', at: '2026-10-01T10:00:00.000Z', n: 3 },
  { ref: 'ANU-2026-00002', name: '+SUM(A1:A9)', mobile: '-1', n: 0 },
  { ref: 'ANU-2026-00003', name: '@cmd', mobile: '' },
]

async function open(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  const zip = await JSZip.loadAsync(bytes)
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const sharedXml = (await zip.file('xl/sharedStrings.xml')?.async('string')) ?? ''
  return { wb, ws: wb.worksheets[0], sheetXml, sharedXml, zip }
}

describe('Excel workbook builder', () => {
  it('produces a real .xlsx (a ZIP package with the OOXML parts), not a CSV', async () => {
    const bytes = await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }])
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const { zip } = await open(bytes)
    expect(zip.file('[Content_Types].xml')).toBeTruthy()
    expect(zip.file('xl/workbook.xml')).toBeTruthy()
    expect(workbookBlob(bytes).type).toBe(XLSX_MIME)
    expect(XLSX_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('names the worksheet, writes the headers, freezes the header row and filters it', async () => {
    const { ws, sheetXml } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }]))
    expect(ws.name).toBe('Students')
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(COLUMNS.map((c) => c.header))
    expect(ws.getRow(1).font?.bold).toBe(true)
    expect(sheetXml).toMatch(/<pane [^>]*ySplit="1"[^>]*state="frozen"/)
    expect(sheetXml).toMatch(/<autoFilter ref="A1:F1"\/>/)
    for (let i = 1; i <= COLUMNS.length; i++) expect(ws.getColumn(i).width).toBeGreaterThanOrEqual(10)
  })

  it('writes user text as literal text, never as a formula (formula-injection protection)', async () => {
    const { ws, sheetXml, sharedXml } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }]))
    expect(sheetXml).not.toMatch(/<f[ >]/) // no formula element anywhere
    expect(ws.getCell('B2').value).toBe('=HYPERLINK("http://evil.example","click")')
    expect(ws.getCell('B2').type).toBe(ExcelJS.ValueType.String)
    expect(ws.getCell('B3').value).toBe('+SUM(A1:A9)')
    expect(ws.getCell('B4').value).toBe('@cmd')
    expect(sharedXml).toContain('=HYPERLINK(&quot;http://evil.example&quot;,&quot;click&quot;)')
  })

  it('keeps identifiers and phone numbers as text (Text format), so Excel does not change them', async () => {
    const { ws, sheetXml } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }]))
    expect(ws.getCell('A2').value).toBe('00123')
    expect(ws.getCell('C2').value).toBe('9000000001')
    expect(ws.getCell('C3').value).toBe('-1')
    expect(ws.getCell('A2').numFmt).toBe('@')
    expect(sheetXml).not.toMatch(/<c r="A2"[^>]*><v>123<\/v>/)
  })

  it('writes dates as real dates (yyyy-mm-dd) and timestamps in India time (yyyy-mm-dd hh:mm)', async () => {
    const { ws } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }]))
    const dob = ws.getCell('D2')
    expect(dob.value).toBeInstanceOf(Date)
    expect((dob.value as Date).toISOString()).toBe('2012-04-09T00:00:00.000Z')
    expect(dob.numFmt).toBe('yyyy-mm-dd')
    const at = ws.getCell('E2')
    expect((at.value as Date).toISOString()).toBe('2026-10-01T15:30:00.000Z') // 10:00 UTC shows as 15:30 IST
    expect(at.numFmt).toBe('yyyy-mm-dd hh:mm')
    expect(ws.getCell('F2').value).toBe(3)
    expect(ws.getCell('F3').value).toBe(0)
  })

  it('leaves missing values as empty cells', async () => {
    const { ws } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: ROWS }]))
    for (const ref of ['D3', 'E3', 'C4', 'D4', 'F4']) expect(ws.getCell(ref).value, ref).toBeNull()
    expect(cellValue('text', undefined)).toBeNull()
    expect(cellValue('date', 'not a date')).toBe('not a date')
  })

  it('handles an empty dataset (headers only) and sanitises sheet names', async () => {
    const { ws } = await open(await buildWorkbook([{ name: 'Students', columns: COLUMNS, rows: [] }]))
    expect(ws.rowCount).toBe(1)
    expect(sheetName('a/b:c?[d]*e')).toBe('a b c  d  e')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
    expect(sheetName('///')).toBe('Sheet1')
  })
})

describe('student Excel export', () => {
  const student: AdminStudent = {
    id: 'stu-secret-id', referenceNo: 'ANU-2026-00001', schoolId: 'sch-1', name: '=cmd|"/c calc"!A1', fatherName: 'F', motherName: 'M', dob: '2012-01-01',
    className: 'Class 6', section: 'A', rollNo: '012', admissionNo: '00045', address: 'Addr', mobile: '9000000001', photoUrl: 'https://example.invalid/signed?token=abc',
    bloodGroup: 'B+', submittedAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', isArchived: false, approvalStatus: 'pending',
    schoolName: 'School', schoolCode: 'S-1', schoolActive: true,
  }

  it('has the explicit column list, with no ids, photo links or storage paths', async () => {
    const headers = STUDENT_EXPORT_COLUMNS.map((c) => c.header)
    expect(headers).toContain('Reference No')
    expect(headers).toContain('Review status')
    expect(headers.join(' ')).not.toMatch(/photo|path|url|\bid\b/i)
    const { ws, sheetXml, sharedXml } = await open(await studentsWorkbook([student]))
    expect(ws.name).toBe('Students')
    const all = sheetXml + sharedXml
    for (const secret of ['stu-secret-id', 'signed', 'token=', 'sch-1']) expect(all).not.toContain(secret)
    expect(ws.getCell('F2').value).toBe('=cmd|"/c calc"!A1') // literal text
    expect(sheetXml).not.toMatch(/<f[ >]/)
    expect(ws.getCell('L2').value).toBe('012') // roll number kept as text
    expect(ws.getCell('M2').value).toBe('00045') // admission number kept as text
  })

  it('names the file by type and date, with the .xlsx extension', () => {
    expect(studentExportFilename(new Date('2026-10-21T20:00:00Z'))).toBe('anuditya-students_2026-10-22.xlsx') // India date
    expect(studentExportFilename()).toMatch(/^anuditya-students_\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})

describe('replaced CSV export controls', () => {
  it('the students page offers Excel and ZIP exports only, and no CSV download code remains in the app', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(import.meta.dirname, '../..')
    const page = fs.readFileSync(path.join(root, 'src/pages/admin/AdminStudentsPage.tsx'), 'utf8')
    expect(page).toContain('Export Excel')
    expect(page).toContain('Export with photos')
    expect(page).not.toMatch(/Export CSV|downloadText|studentsCsv|text\/csv/)
    expect(fs.existsSync(path.join(root, 'src/lib/csv.ts'))).toBe(false)
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    const offenders = walk(path.join(root, 'src'))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
      .filter((f) => /new Blob\([^)]*text\/csv|\.csv['"`]\s*\)|download=.*\.csv/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
