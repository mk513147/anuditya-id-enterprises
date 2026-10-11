import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FILE_CATEGORIES } from '@/types'
import { normalizeContact, schoolFileFieldsSchema } from '@/validations/fileSubmission'
import { MAX_UPLOAD_BYTES, sniffSpreadsheet, validateUploadFile } from '@/validations/upload'
import { SchoolFileSubmissionForm } from './SchoolFileSubmissionForm'

const VALID = {
  schoolId: 'sch-1', contactPerson: 'Asha Teacher', contactDetails: '9876543210', category: 'student_data',
  description: 'Student list for the 2026-27 session, Class 10, for ID card printing.', instructions: '',
}
const errorsFor = (over: Record<string, unknown>) => {
  const r = schoolFileFieldsSchema.safeParse({ ...VALID, ...over })
  return r.success ? [] : [...new Set(r.error.issues.map((i) => String(i.path[0])))]
}

describe('submission fields', () => {
  it('accepts a complete submission, with or without instructions', () => {
    expect(errorsFor({})).toEqual([])
    expect(errorsFor({ instructions: 'Needed by Friday' })).toEqual([])
  })

  it('requires every mandatory field, and treats whitespace as empty', () => {
    const empty = schoolFileFieldsSchema.safeParse({ schoolId: ' ', contactPerson: '   ', contactDetails: '  ', category: '', description: '     ', instructions: '' })
    expect(empty.success).toBe(false)
    expect([...new Set(empty.error!.issues.map((i) => i.path[0]))].sort()).toEqual(['category', 'contactDetails', 'contactPerson', 'description', 'schoolId'])
  })

  it.each([
    [{ schoolId: '' }, 'schoolId'],
    [{ contactPerson: 'A' }, 'contactPerson'],
    [{ contactPerson: 'x'.repeat(81) }, 'contactPerson'],
    [{ contactPerson: 'Asha <b>' }, 'contactPerson'],
    [{ contactDetails: '12345' }, 'contactDetails'],
    [{ contactDetails: '5876543210' }, 'contactDetails'],
    [{ contactDetails: 'asha@school' }, 'contactDetails'],
    [{ category: 'approved' }, 'category'],
    [{ description: 'Too short' }, 'description'],
    [{ description: 'x'.repeat(1001) }, 'description'],
    [{ instructions: 'x'.repeat(1001) }, 'instructions'],
  ])('rejects %j', (over, field) => {
    expect(errorsFor(over)).toEqual([field])
  })

  it('normalises contact details exactly as the database does', () => {
    expect(normalizeContact('+91 98765-43210')).toBe('9876543210')
    expect(normalizeContact('(0)98765 43210')).toBe('9876543210')
    expect(normalizeContact('919876543210')).toBe('9876543210')
    expect(normalizeContact('  Office@School.EXAMPLE ')).toBe('office@school.example')
    expect(normalizeContact('12345')).toBeNull()
    expect(normalizeContact('a@b')).toBeNull()
  })
})

describe('file checks', () => {
  const file = (bytes: number[] | string, name: string, type = '') => new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name, { type })

  it('accepts only .xlsx, .xls and .csv within the size limit', () => {
    expect(validateUploadFile(file('a,b', 'list.csv', 'text/csv'))).toBeNull()
    expect(validateUploadFile(file('x', 'list.pdf', 'application/pdf'))).toMatch(/Unsupported/)
    expect(validateUploadFile(file('x', 'list.xlsm'))).toMatch(/Unsupported/)
    expect(validateUploadFile(file('x', 'photo.csv', 'image/png'))).toMatch(/Unsupported/) // the browser's type can only reject, never vouch
    expect(validateUploadFile(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.csv'))).toMatch(/too large/)
    expect(validateUploadFile(file('', 'empty.csv'))).toMatch(/empty/)
    expect(validateUploadFile(null)).toMatch(/select a file/)
  })

  it('checks that the first bytes match the claimed format (without opening the spreadsheet)', async () => {
    expect(await sniffSpreadsheet(file([0x50, 0x4b, 0x03, 0x04, 1, 2], 'a.xlsx'))).toBeNull()
    expect(await sniffSpreadsheet(file([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0], 'a.xls'))).toBeNull()
    expect(await sniffSpreadsheet(file('name,class\nA,10\n', 'a.csv'))).toBeNull()
    expect(await sniffSpreadsheet(file('a,b', 'renamed.xlsx'))).toMatch(/not a real .xlsx/)
    expect(await sniffSpreadsheet(file('<html><table>', 'export.xls'))).toMatch(/not a real .xls/)
    expect(await sniffSpreadsheet(file([0x4d, 0x5a, 0, 0], 'program.csv'))).toMatch(/binary/)
  })
})

describe('Submit School Data File form', () => {
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <SchoolFileSubmissionForm onSubmitted={() => {}} />
    </QueryClientProvider>,
  )

  it('is titled and has every field, with the required ones marked', () => {
    expect(html).toContain('Submit School Data File')
    for (const [id, label] of [['sd-school', 'School name'], ['sd-person', 'Contact person'], ['sd-contact', 'Contact details'], ['sd-category', 'File category'], ['sd-description', 'File description'], ['sd-instructions', 'Additional instructions']]) {
      expect(html, label).toMatch(new RegExp(`for="${id}"[^>]*>${label}`))
    }
    expect(html.match(/\(required\)/g)?.length).toBe(6) // school, person, contact, category, description, file
    expect(html).not.toMatch(/for="sd-instructions"[^>]*>Additional instructions<span aria-hidden="true" class="text-destructive"> \*/)
  })

  it('says either an email or a phone number is acceptable, and explains the description', () => {
    expect(html).toContain('An email address or a 10-digit mobile number')
    expect(html).toContain('academic session')
    expect(html).toContain('placeholder="Student list for the 2026–27 session, Class 10, for ID card printing."')
  })

  it('offers the four categories by stable value', () => {
    for (const c of FILE_CATEGORIES) expect(html).toContain(`<option value="${c}"`)
    expect(html).toContain('Corrections to previously submitted data')
  })

  it('accepts only the spreadsheet formats in the picker, and loads schools before allowing a choice', () => {
    expect(html).toMatch(/type="file"[^>]*accept="\.xlsx,\.xls,\.csv,/)
    expect(html).toContain('Loading schools…')
    expect(html).toMatch(/<select[^>]*id="sd-school"[^>]*disabled=""/)
  })

  it('tells the submitter the administrator reviews the file, without extra legal checkboxes', () => {
    expect(html).toContain("reviewed by AnudityaID&#x27;s administrator")
    expect(html).not.toMatch(/type="checkbox"/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>.*Submit File/)
  })
})
