import { describe, expect, it } from 'vitest'
import { schoolSchema } from './school'
import { normalizeMobile, studentEditSchema, studentSchema, toStudentFields, validatePhotoFile } from './student'
import { MAX_UPLOAD_BYTES, validateUploadFile } from './upload'

const file = (name: string, type = '', size = 100) => new File([new Uint8Array(size)], name, { type })

const validSchool = {
  name: "St. Mary's School", slug: 'st-marys-school', code: 'STM-001', contactPerson: 'Demo Principal',
  phone: '9000000001', email: '', address: '',
}

describe('schoolSchema', () => {
  it('accepts a valid school (email and address optional)', () => {
    expect(schoolSchema.safeParse(validSchool).success).toBe(true)
  })
  it.each([
    ['short name', { name: 'ab' }],
    ['uppercase slug', { slug: 'Bad-Slug' }],
    ['slug with spaces', { slug: 'bad slug' }],
    ['double hyphen slug', { slug: 'bad--slug' }],
    ['slug too short', { slug: 'ab' }],
    ['bad code', { code: 'x' }],
    ['code with symbols', { code: 'ST M!' }],
    ['landline-looking phone', { phone: '1234567890' }],
    ['letters in phone', { phone: 'abcdefghij' }],
    ['bad email', { email: 'not-an-email' }],
  ])('rejects %s', (_label, patch) => {
    expect(schoolSchema.safeParse({ ...validSchool, ...patch }).success).toBe(false)
  })
  it('accepts +91 phone formatting', () => {
    expect(schoolSchema.safeParse({ ...validSchool, phone: '+91 90000 00001' }).success).toBe(true)
  })
})

describe('normalizeMobile', () => {
  it.each([
    ['+91 98765 43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['98765-43210', '9876543210'],
  ])('%s -> %s', (input, expected) => expect(normalizeMobile(input)).toBe(expected))
})

describe('studentSchema', () => {
  const base = {
    schoolId: 'sch-1', name: 'Aarav Sharma', fatherName: 'Rakesh Sharma', motherName: 'Sunita Sharma', dob: '2012-04-12',
    className: 'Class 6', section: 'A', rollNo: '12', admissionNo: '2024/0123', address: '1 Sample Road, Demo Town',
    mobile: '9876543210', bloodGroup: '', houseName: '', houseColour: '', busRoute: '', busStoppage: '',
    photo: file('p.png', 'image/png'),
  }
  it('accepts a complete submission with every new field empty (they are optional)', () => {
    expect(studentSchema.safeParse(base).success).toBe(true)
  })
  it('requires a school', () => {
    const r = studentSchema.safeParse({ ...base, schoolId: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Please select your school.')
  })
  it('accepts the five new optional fields', () => {
    const r = studentSchema.safeParse({ ...base, bloodGroup: 'O+', houseName: 'Ashoka', houseColour: 'Red', busRoute: 'Route 3', busStoppage: 'Temple Road' })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown blood group and disallowed characters', () => {
    expect(studentSchema.safeParse({ ...base, bloodGroup: 'Z+' }).success).toBe(false)
    expect(studentSchema.safeParse({ ...base, houseName: '<script>' }).success).toBe(false)
  })
  it('rejects future dates of birth and invalid mobiles', () => {
    expect(studentSchema.safeParse({ ...base, dob: '2999-01-01' }).success).toBe(false)
    expect(studentSchema.safeParse({ ...base, mobile: '1234567890' }).success).toBe(false)
  })
  it('validates the photo type and size', () => {
    expect(validatePhotoFile(file('a.gif', 'image/gif'))).toBe('Please upload a JPG, JPEG or PNG image.')
    expect(validatePhotoFile(file('a.png', 'image/png', 3 * 1024 * 1024))).toContain('smaller than 2 MB')
    expect(validatePhotoFile(file('a.jpeg', 'image/jpeg'))).toBeNull()
  })
})

describe('validateUploadFile', () => {
  it.each(['a.xlsx', 'a.xls', 'a.csv', 'A.CSV'])('accepts %s', (n) => expect(validateUploadFile(file(n))).toBeNull())
  it.each(['a.pdf', 'a.docx', 'a.jpg', 'a.zip', 'a.exe', 'a.xlsx.exe', 'noext'])('rejects %s', (n) =>
    expect(validateUploadFile(file(n))).toBe('Unsupported file type.'))
  it('accepts odd-but-harmless MIME types but rejects a disguised image', () => {
    for (const t of ['', 'text/plain', 'application/octet-stream', 'application/vnd.ms-excel']) expect(validateUploadFile(file('a.csv', t))).toBeNull()
    expect(validateUploadFile(file('a.xlsx', 'image/png'))).toBe('Unsupported file type.')
  })
  it('enforces the size limit and rejects empty files', () => {
    expect(validateUploadFile(file('a.csv', 'text/csv', MAX_UPLOAD_BYTES))).toBeNull()
    expect(validateUploadFile(file('a.csv', 'text/csv', MAX_UPLOAD_BYTES + 1))).toBe('File is too large. Maximum size is 10 MB.')
    expect(validateUploadFile(file('a.csv', 'text/csv', 0))).toContain('empty')
    expect(validateUploadFile(undefined)).toBe('Please select a file.')
  })
})

describe('studentEditSchema (admin edit)', () => {
  const base = {
    name: 'Aarav Sharma', fatherName: 'Rakesh Sharma', motherName: 'Sunita Sharma', dob: '2012-04-12', className: 'Class 6', section: 'a',
    rollNo: '12', admissionNo: '2024/0123', address: '1 Sample Road, Demo Town', mobile: '+91 98765 43210',
    bloodGroup: '', houseName: '', houseColour: '', busRoute: '', busStoppage: '',
  }
  it('accepts a complete record with every optional field empty', () => {
    expect(studentEditSchema.safeParse(base).success).toBe(true)
  })
  it('needs no photo and no school (neither is editable)', () => {
    const r = studentEditSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect('photo' in r.data || 'schoolId' in r.data).toBe(false)
  })
  it.each([
    ['empty name', { name: '' }],
    ['numeric name', { name: '1234' }],
    ['future DOB', { dob: '2999-01-01' }],
    ['malformed DOB', { dob: '12/04/2012' }],
    ['bad mobile', { mobile: '12345' }],
    ['no class', { className: '' }],
    ['unknown class', { className: 'Class 99' }],
    ['symbol in roll no', { rollNo: 'A#1' }],
    ['short address', { address: 'short' }],
    ['unknown blood group', { bloodGroup: 'X+' }],
  ])('rejects %s', (_l, patch) => {
    expect(studentEditSchema.safeParse({ ...base, ...patch }).success).toBe(false)
  })
  it('toStudentFields normalises like the public form: upper-case section, bare mobile, empty optionals -> undefined', () => {
    const parsed = studentEditSchema.parse({ ...base, bloodGroup: 'O+' })
    expect(toStudentFields(parsed)).toMatchObject({ section: 'A', mobile: '9876543210', bloodGroup: 'O+', houseName: undefined, busStoppage: undefined })
  })
})
