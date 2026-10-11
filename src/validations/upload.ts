import type { UploadedFileType } from '@/types'

/** Single source of truth for the upload size limit. Change it here only. */
export const MAX_UPLOAD_MB = 10
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

export const ACCEPTED_EXTENSIONS: UploadedFileType[] = ['xlsx', 'xls', 'csv']

/**
 * Value for <input accept>. This is only a hint to the browser/OS file picker;
 * real validation is `validateUploadFile`, which also runs on drag-and-drop.
 */
export const FILE_INPUT_ACCEPT = [
  ...ACCEPTED_EXTENSIONS.map((e) => `.${e}`),
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
].join(',')

/**
 * MIME types that clearly mean "not a spreadsheet". Browsers report CSV/Excel MIME types
 * inconsistently (often empty, text/plain or application/octet-stream), so we do NOT require a
 * match; we only reject a file when its MIME type positively identifies another kind of file
 * (for example a photo renamed to .xlsx).
 */
const REJECTED_MIME_PREFIXES = ['image/', 'video/', 'audio/']
const REJECTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-msdownload',
  'application/x-dosexec',
  'application/json',
  'application/xml',
  'text/html',
])

export const getExtension = (name: string): string => {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export const isAcceptedExtension = (ext: string): ext is UploadedFileType =>
  (ACCEPTED_EXTENSIONS as string[]).includes(ext)

export const FILE_TYPE_LABEL: Record<UploadedFileType, string> = {
  xlsx: 'Excel Spreadsheet (.xlsx)',
  xls: 'Excel Spreadsheet (.xls)',
  csv: 'CSV File (.csv)',
}

/** Returns an error message, or null when the file can be uploaded. */
export function validateUploadFile(file: File | null | undefined): string | null {
  if (!file) return 'Please select a file.'
  if (!isAcceptedExtension(getExtension(file.name))) return 'Unsupported file type.'
  const mime = file.type.toLowerCase()
  if (REJECTED_MIME_TYPES.has(mime) || REJECTED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return 'Unsupported file type.'
  if (file.size === 0) return 'This file is empty. Please choose another file.'
  if (file.size > MAX_UPLOAD_BYTES) return `File is too large. Maximum size is ${MAX_UPLOAD_MB} MB.`
  return null
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b)

/**
 * A light content check in the browser: the first bytes must match the format the extension claims (.xlsx is a ZIP
 * package, .xls an OLE2 compound file, .csv plain text with no NUL bytes). It catches renamed files and obvious mistakes.
 * It does NOT prove the file is safe: spreadsheets stay untrusted, and nothing here opens or evaluates their contents.
 * Returns an error message, or null.
 */
export async function sniffSpreadsheet(file: File): Promise<string | null> {
  const ext = getExtension(file.name)
  let head: Uint8Array
  try {
    head = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  } catch {
    return 'This file could not be read. Please choose it again.'
  }
  if (ext === 'xlsx' && !startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return 'This file is not a real .xlsx workbook. Please save it from Excel as .xlsx or .csv and try again.'
  if (ext === 'xls' && !startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'This file is not a real .xls workbook. Please save it from Excel as .xlsx or .csv and try again.'
  if (ext === 'csv' && head.includes(0)) return 'This .csv file contains binary data. Please export it again as a plain CSV file.'
  return null
}
