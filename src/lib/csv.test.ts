import { describe, expect, it } from 'vitest'
import { STUDENT_EXPORT_COLUMNS, studentsCsv } from '@/features/students/admin/studentExport'
import type { AdminStudent } from '@/services/types'
import { csvCell, toCsv } from './csv'

describe('CSV cells', () => {
  it.each([
    ['=HYPERLINK("http://x","y")', `"'=HYPERLINK(""http://x"",""y"")"`],
    ['+91 9000000000', `"'+91 9000000000"`],
    ['-2+3', `"'-2+3"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\tcmd', `"'\tcmd"`],
    ['\r=1', `"'\r=1"`],
  ])('neutralises a formula: %j', (raw, expected) => {
    expect(csvCell(raw)).toBe(expected)
  })

  it('quotes everything and doubles quotes; empty for null/undefined', () => {
    expect(csvCell('St. Mary\'s, "North"')).toBe('"St. Mary\'s, ""North"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell(42)).toBe('"42"')
    expect(csvCell('A+')).toBe('"A+"') // only a LEADING sign is dangerous
  })

  it('writes a header row, CRLF lines and a BOM', () => {
    const csv = toCsv([{ header: 'Name', value: (r: { n: string }) => r.n }], [{ n: 'a' }, { n: 'b' }])
    expect(csv).toBe('﻿"Name"\r\n"a"\r\n"b"\r\n')
  })
})

describe('student export', () => {
  const student: AdminStudent = {
    id: 'secret-id', referenceNo: 'ANU-2026-00001', schoolId: 'sch-1', name: '=cmd|"/c calc"!A1', fatherName: 'F', motherName: 'M', dob: '2012-01-01',
    className: 'Class 6', section: 'A', rollNo: '1', admissionNo: 'ADM-1', address: 'Addr', mobile: '9000000001', photoUrl: 'https://example.invalid/signed?token=abc',
    bloodGroup: 'B+', submittedAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', isArchived: false, approvalStatus: 'pending',
    schoolName: 'School', schoolCode: 'S-1', schoolActive: true,
  }

  it('uses an explicit column list with no ids, photo links or storage paths', () => {
    const headers = STUDENT_EXPORT_COLUMNS.map((c) => c.header)
    expect(headers).toContain('Reference No')
    expect(headers).toContain('Review status')
    expect(headers.join(' ')).not.toMatch(/photo|id$|path|url/i)
    const csv = studentsCsv([student])
    expect(csv).not.toContain('secret-id')
    expect(csv).not.toContain('signed')
    expect(csv).not.toContain('sch-1')
  })

  it('neutralises a formula typed into a public form field', () => {
    expect(studentsCsv([student])).toContain(`"'=cmd|""/c calc""!A1"`)
    expect(studentsCsv([student])).toContain('"B+"')
  })
})
