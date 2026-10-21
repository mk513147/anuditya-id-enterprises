/**
 * Excel (.xlsx) export, built with ExcelJS (loaded only when an export runs, so normal pages do not download it).
 *
 * Safety: every value is written as a literal cell (text, number or date). Nothing is ever written as a formula, so a
 * value such as "=HYPERLINK(...)" typed into a public form is stored and shown as plain text and cannot run
 * (no <f> elements are produced; see the tests). Identifiers use the Text number format so Excel does not turn
 * "00123" or "9000000001" into numbers.
 */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type XlsxCellType = 'text' | 'number' | 'date' | 'datetime'
export type XlsxValue = string | number | null | undefined

export interface XlsxColumn<T> {
  header: string
  value: (row: T) => XlsxValue
  /** text (default): stored as text. date: a YYYY-MM-DD value. datetime: an ISO timestamp, shown in India time. */
  type?: XlsxCellType
  /** Column width in characters; computed from the content when omitted. */
  width?: number
}

export interface XlsxSheet<T> {
  name: string
  columns: XlsxColumn<T>[]
  rows: T[]
}

const FORMAT: Record<XlsxCellType, string | undefined> = { text: '@', number: undefined, date: 'yyyy-mm-dd', datetime: 'yyyy-mm-dd hh:mm' }
const IST_OFFSET_MS = 330 * 60_000

/** Excel sheet names: at most 31 characters, none of : \ / ? * [ ]. */
export const sheetName = (name: string) => name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1'

/** Converts a value to what goes into the cell. Dates become real Excel dates (India wall-clock time for timestamps). */
export function cellValue(type: XlsxCellType, v: XlsxValue): string | number | Date | null {
  if (v === null || v === undefined || v === '') return null
  if (type === 'number') return typeof v === 'number' ? v : Number.isFinite(Number(v)) ? Number(v) : String(v)
  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : String(v)
  }
  if (type === 'datetime') {
    const ms = Date.parse(String(v))
    // ExcelJS stores dates as UTC serial numbers; shifting by +5:30 makes Excel show the India time of the event.
    return Number.isNaN(ms) ? String(v) : new Date(ms + IST_OFFSET_MS)
  }
  return String(v)
}

const textLength = (v: unknown) => (v instanceof Date ? 16 : String(v ?? '').length)

/** Builds the workbook. Returns the .xlsx bytes. */
export async function buildWorkbook<T>(sheets: XlsxSheet<T>[], meta: { title?: string } = {}): Promise<Uint8Array> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Anuditya ID administrator export'
  wb.created = new Date()
  if (meta.title) wb.title = meta.title

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheetName(sheet.name), { views: [{ state: 'frozen', ySplit: 1 }] })
    const data = sheet.rows.map((row) => sheet.columns.map((c) => cellValue(c.type ?? 'text', c.value(row))))
    ws.columns = sheet.columns.map((c, i) => ({
      header: c.header,
      key: `c${i}`,
      width: c.width ?? Math.min(60, Math.max(10, textLength(c.header), ...data.slice(0, 500).map((r) => textLength(r[i]))) + 2),
      style: FORMAT[c.type ?? 'text'] ? { numFmt: FORMAT[c.type ?? 'text'] } : {},
    }))
    for (const values of data) ws.addRow(values)
    const header = ws.getRow(1)
    header.font = { bold: true }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } }
    header.border = { bottom: { style: 'thin', color: { argb: 'FF9AA5B1' } } }
    header.alignment = { vertical: 'middle' }
    if (sheet.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } }
  }
  const out = await wb.xlsx.writeBuffer()
  return new Uint8Array(out as ArrayBuffer)
}

export const workbookBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: XLSX_MIME })
