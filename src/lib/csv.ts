/**
 * CSV export helpers. Columns are always listed explicitly (never "every field of the record"), and every cell is made
 * safe for spreadsheet programs:
 *  - a value starting with = + - @ (or a tab / carriage return) is prefixed with an apostrophe, so Excel, Sheets or
 *    LibreOffice show it as text instead of running it as a formula ("CSV injection");
 *  - every cell is quoted, and quotes inside a value are doubled (RFC 4180).
 */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(raw: string | number | boolean | null | undefined): string {
  let text = raw === null || raw === undefined ? '' : String(raw)
  if (FORMULA_START.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','))
  // CRLF line endings and a byte-order mark so Excel opens UTF-8 names (e.g. Hindi) correctly.
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Saves text as a file in the browser. The data never leaves the device: it is a local Blob, not an upload. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
