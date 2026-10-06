import { describe, expect, it, vi } from 'vitest'
import { RepositoryError } from '../errors'
import { mockDashboardRepository } from './dashboard'
import { db } from './db'
import { mockSchoolRepository as schools } from './schools'
import { mockStudentRepository as students } from './students'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const input = (over = {}) => ({
  name: 'New School', slug: 'new-school', code: 'NEW-100', contactPerson: 'Demo', phone: '9000000100', ...over,
})
const submission = (over = {}) => ({
  schoolId: 'sch-sunrise', name: 'Test Student', fatherName: 'F', motherName: 'M', dob: '2013-01-01', className: 'Class 5', section: 'A',
  rollNo: '1', admissionNo: 'ADM-1', address: '1 Test Road, Demo', mobile: '9876543210', photo: new File(['x'], 'p.png', { type: 'image/png' }), ...over,
})

describe('school repository', () => {
  it('searches by name or code, case-insensitively, and filters by status', async () => {
    expect((await schools.list({ search: 'stm' })).map((s) => s.code)).toEqual(['STM-001'])
    expect((await schools.list({ search: 'GREEN VALLEY' })).map((s) => s.code)).toEqual(['GVC-002'])
    expect((await schools.list({ status: 'inactive' })).map((s) => s.code)).toEqual(['MDA-004'])
    expect((await schools.list({ status: 'active' })).length).toBe(4)
  })

  it('lists only active schools for the public dropdown', async () => {
    const active = await schools.listActive()
    expect(active.every((s) => s.isActive)).toBe(true)
    expect(active.some((s) => s.code === 'MDA-004')).toBe(false)
  })

  it('creates a school, uppercasing the code', async () => {
    const created = await schools.create(input({ code: 'new-100' }))
    expect(created.code).toBe('NEW-100')
    expect(created.isActive).toBe(true)
    expect(db.schools.some((s) => s.id === created.id)).toBe(true)
  })

  it('rejects a duplicate code regardless of case', async () => {
    await expect(schools.create(input({ slug: 'another', code: 'stm-001' }))).rejects.toMatchObject({ code: 'duplicate_code' })
  })

  it('rejects a duplicate slug and suggests the next free one', async () => {
    const err = await schools.create(input({ code: 'DUP-1', slug: 'ST-MARYS-SCHOOL' })).catch((e) => e)
    expect(err).toBeInstanceOf(RepositoryError)
    expect(err.code).toBe('duplicate_slug')
    expect(err.suggestion).toBe('st-marys-school-2')
  })

  it('allows a school to keep its own code and slug when edited, but not take another school\'s', async () => {
    const stm = db.schools.find((s) => s.code === 'STM-001')!
    await expect(schools.update(stm.id, { ...input(), name: stm.name, slug: stm.slug, code: stm.code })).resolves.toMatchObject({ code: 'STM-001' })
    await expect(schools.update(stm.id, input({ slug: stm.slug, code: 'GVC-002' }))).rejects.toMatchObject({ code: 'duplicate_code' })
  })

  it('resolves slugs to active / inactive / not_found without leaking inactive details', async () => {
    expect((await schools.resolveBySlug('st-marys-school')).status).toBe('active')
    expect((await schools.resolveBySlug('ST-MARYS-SCHOOL')).status).toBe('active')
    const inactive = await schools.resolveBySlug('model-academy')
    expect(inactive).toEqual({ status: 'inactive' })
    expect(await schools.resolveBySlug('nope')).toEqual({ status: 'not_found' })
  })

  it('activates and deactivates', async () => {
    const stm = db.schools.find((s) => s.code === 'STM-001')!
    expect((await schools.setActive(stm.id, false)).isActive).toBe(false)
    expect((await schools.resolveBySlug('st-marys-school')).status).toBe('inactive')
    expect((await schools.setActive(stm.id, true)).isActive).toBe(true)
  })

  it('reports not_found for unknown ids', async () => {
    await expect(schools.getDetail('missing')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('student repository', () => {
  it('stores the submission against the correct school and generates the reference', async () => {
    const before = db.students.length
    const r = await students.submit(submission({ bloodGroup: 'O+', houseName: 'Ashoka', houseColour: 'Red', busRoute: 'R1', busStoppage: 'Stop' }))
    expect(r.schoolName).toBe('Sunrise Public School')
    expect(r.referenceNo).toMatch(/^ANU-\d{4}-\d{5}$/)
    expect(db.students).toHaveLength(before + 1)
    const stored = db.students.at(-1)!
    expect(stored).toMatchObject({ schoolId: 'sch-sunrise', bloodGroup: 'O+', houseName: 'Ashoka', houseColour: 'Red', busRoute: 'R1', busStoppage: 'Stop' })
    expect('photo' in stored).toBe(false)
    expect(stored).toMatchObject({ isArchived: false })
    expect(stored.updatedAt).toBe(stored.submittedAt)
  })

  it('numbers references sequentially', async () => {
    const a = await students.submit(submission())
    const b = await students.submit(submission())
    expect(Number(b.referenceNo.slice(-5))).toBe(Number(a.referenceNo.slice(-5)) + 1)
  })

  it('rejects unknown and inactive schools (the UI is never the authority)', async () => {
    await expect(students.submit(submission({ schoolId: 'missing' }))).rejects.toMatchObject({ code: 'school_unavailable' })
    await expect(students.submit(submission({ schoolId: 'sch-model' }))).rejects.toMatchObject({ code: 'school_unavailable' })
  })

  it('fails on the documented FAIL admission number without storing anything', async () => {
    const before = db.students.length
    await expect(students.submit(submission({ admissionNo: 'fail' }))).rejects.toThrow()
    expect(db.students).toHaveLength(before)
  })
})

describe('dashboard repository', () => {
  it('derives every figure from the shared mock tables', async () => {
    const { counts, recentOrders, recentSchools } = await mockDashboardRepository.get()
    expect(counts.totalSchools).toBe(db.schools.length)
    expect(counts.activeSchools).toBe(db.schools.filter((s) => s.isActive).length)
    expect(counts.totalStudents).toBe(db.students.filter((s) => !s.isArchived).length) // archived students are not counted
    expect(counts.uploadedFiles).toBe(db.files.length)
    expect(counts.pendingOrders).toBe(db.orders.filter((o) => ['Order Received', 'Data Verification'].includes(o.status)).length)
    expect(counts.awaitingCompletion).toBe(db.orders.filter((o) => o.status !== 'Delivered').length)
    expect(recentOrders.length).toBeLessThanOrEqual(5)
    expect(recentSchools.length).toBeLessThanOrEqual(4)
  })
})
