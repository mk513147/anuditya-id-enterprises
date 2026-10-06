import { describe, expect, it, vi } from 'vitest'
import type { StudentEditInput } from '@/types'
import { mockDashboardRepository } from './dashboard'
import { db } from './db'
import { mockSchoolRepository as schools } from './schools'
import { mockStudentRepository as repo } from './students'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const byRef = (ref: string) => db.students.find((s) => s.referenceNo === ref)!
const edit = (id: string, over: Partial<StudentEditInput> = {}): StudentEditInput => {
  const s = db.students.find((x) => x.id === id)!
  return {
    name: s.name, fatherName: s.fatherName, motherName: s.motherName, dob: s.dob, className: s.className, section: s.section,
    rollNo: s.rollNo, admissionNo: s.admissionNo, address: s.address, mobile: s.mobile,
    bloodGroup: s.bloodGroup, houseName: s.houseName, houseColour: s.houseColour, busRoute: s.busRoute, busStoppage: s.busStoppage, ...over,
  }
}
const ids = (r: { items: { id: string }[] }) => r.items.map((s) => s.id)
const ALL = { pageSize: 100 }

describe('student list: defaults and archive visibility', () => {
  it('hides archived students by default and reports overall counts', async () => {
    const r = await repo.list(ALL)
    expect(r.items.every((s) => !s.isArchived)).toBe(true)
    expect(r.total).toBe(db.students.filter((s) => !s.isArchived).length)
    expect(r.counts).toEqual({ active: db.students.filter((s) => !s.isArchived).length, archived: db.students.filter((s) => s.isArchived).length })
    expect(r.counts.archived).toBeGreaterThan(0)
  })

  it('can show only archived students, or everything', async () => {
    const archived = await repo.list({ ...ALL, status: 'archived' })
    expect(archived.items.length).toBeGreaterThan(0)
    expect(archived.items.every((s) => s.isArchived)).toBe(true)
    const all = await repo.list({ ...ALL, status: 'all' })
    expect(all.total).toBe(db.students.length)
  })

  it('sorts newest submission first', async () => {
    const r = await repo.list(ALL)
    const times = r.items.map((s) => s.submittedAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('joins school name/code/active by ID', async () => {
    const r = await repo.list({ ...ALL, status: 'all' })
    for (const s of r.items) {
      const school = db.schools.find((x) => x.id === s.schoolId)!
      expect([s.schoolName, s.schoolCode, s.schoolActive]).toEqual([school.name, school.code, school.isActive])
    }
  })

  it('keeps students of an INACTIVE school fully visible', async () => {
    const model = db.schools.find((s) => s.id === 'sch-model')!
    expect(model.isActive).toBe(false)
    const r = await repo.list({ ...ALL, schoolId: 'sch-model' })
    expect(r.total).toBeGreaterThan(0)
    expect(r.items.every((s) => s.schoolActive === false && s.schoolName === 'Model Academy')).toBe(true)
  })
})

describe('student search', () => {
  it('matches the name, case-insensitively and partially', async () => {
    expect((await repo.list({ ...ALL, search: 'aarav' })).items.map((s) => s.name)).toEqual(['Aarav Demo'])
    expect((await repo.list({ ...ALL, search: 'ARAV DE' })).items.map((s) => s.name)).toEqual(['Aarav Demo'])
  })
  it('matches the reference number', async () => {
    expect(ids(await repo.list({ ...ALL, search: 'ANU-2026-00003' }))).toEqual(['stu-3'])
  })
  it('matches the admission number', async () => {
    expect(ids(await repo.list({ ...ALL, search: 'stm/2021/0412' }))).toEqual(['stu-1'])
  })
  it('matches the roll number', async () => {
    const r = await repo.list({ ...ALL, search: '31', schoolId: 'sch-greenvalley' })
    expect(ids(r)).toEqual(['stu-3'])
  })
  it('trims whitespace and returns nothing for no match', async () => {
    expect(ids(await repo.list({ ...ALL, search: '  priya  ' }))).toEqual(['stu-2'])
    const none = await repo.list({ ...ALL, search: 'zzzz-no-match' })
    expect(none.total).toBe(0)
    expect(none.items).toEqual([])
    expect(none.totalPages).toBe(1)
  })
  it('does not search archived students unless asked', async () => {
    const archivedName = db.students.find((s) => s.isArchived)!.name
    expect((await repo.list({ ...ALL, search: archivedName })).total).toBe(0)
    expect((await repo.list({ ...ALL, search: archivedName, status: 'archived' })).total).toBe(1)
  })
})

describe('student filters', () => {
  it('filters by school (by ID)', async () => {
    const r = await repo.list({ ...ALL, schoolId: 'sch-sunrise' })
    expect(r.items.every((s) => s.schoolId === 'sch-sunrise')).toBe(true)
    expect(r.total).toBe(db.students.filter((s) => s.schoolId === 'sch-sunrise' && !s.isArchived).length)
  })
  it('filters by class', async () => {
    const r = await repo.list({ ...ALL, className: 'Class 6' })
    expect(r.total).toBeGreaterThan(0)
    expect(r.items.every((s) => s.className === 'Class 6')).toBe(true)
  })
  it('filters by section, case-insensitively', async () => {
    const lower = await repo.list({ ...ALL, section: 'b' })
    const upper = await repo.list({ ...ALL, section: 'B' })
    expect(lower.total).toBeGreaterThan(0)
    expect(ids(lower)).toEqual(ids(upper))
    expect(lower.items.every((s) => s.section === 'B')).toBe(true)
  })
  it('filters by inclusive submission date range', async () => {
    const day = '2026-08-03'
    const r = await repo.list({ ...ALL, submittedFrom: day, submittedTo: day })
    expect(ids(r).sort()).toEqual(['stu-1', 'stu-2'])
    const from = await repo.list({ ...ALL, submittedFrom: '2026-09-01' })
    expect(from.items.every((s) => s.submittedAt >= '2026-08-31')).toBe(true)
    const to = await repo.list({ ...ALL, submittedTo: '2026-08-04' })
    expect(to.items.every((s) => s.submittedAt < '2026-08-05')).toBe(true)
  })
  it('combines filters with AND', async () => {
    const r = await repo.list({ ...ALL, schoolId: 'sch-stmarys', className: 'Class 6', section: 'A' })
    expect(r.items.map((s) => s.name).sort()).toEqual(['Aarav Demo', 'Diya Specimen'])
    const narrowed = await repo.list({ ...ALL, schoolId: 'sch-stmarys', className: 'Class 6', section: 'A', search: 'diya' })
    expect(narrowed.items.map((s) => s.name)).toEqual(['Diya Specimen'])
    const empty = await repo.list({ ...ALL, schoolId: 'sch-sunrise', className: 'Class 6' })
    expect(empty.total).toBe(0)
  })
  it('returns an empty result (not an error) for an unknown school ID', async () => {
    const r = await repo.list({ ...ALL, schoolId: 'no-such-school' })
    expect(r.total).toBe(0)
  })
  it('lists the distinct sections for the filter', async () => {
    const { sections } = await repo.getFilterOptions()
    expect(sections).toEqual([...sections].sort())
    expect(sections).toContain('A')
    expect(new Set(sections).size).toBe(sections.length)
  })
})

describe('pagination', () => {
  it('splits results into pages and reports totals', async () => {
    const total = db.students.filter((s) => !s.isArchived).length
    const p1 = await repo.list({ pageSize: 5, page: 1 })
    expect(p1.items).toHaveLength(5)
    expect(p1.totalPages).toBe(Math.ceil(total / 5))
    const last = await repo.list({ pageSize: 5, page: p1.totalPages })
    expect(last.items).toHaveLength(total - 5 * (p1.totalPages - 1))
    expect(new Set([...ids(p1), ...ids(last)]).size).toBe(p1.items.length + last.items.length)
  })
  it('clamps out-of-range pages', async () => {
    const r = await repo.list({ pageSize: 5, page: 999 })
    expect(r.page).toBe(r.totalPages)
    expect(r.items.length).toBeGreaterThan(0)
    expect((await repo.list({ pageSize: 5, page: -3 })).page).toBe(1)
  })
})

describe('student detail', () => {
  it('returns the joined record and the school’s orders (newest first)', async () => {
    const { student, schoolOrders } = await repo.getDetail('stu-1')
    expect(student).toMatchObject({ schoolName: "St. Mary's School", schoolCode: 'STM-001', schoolActive: true, referenceNo: 'ANU-2026-00001' })
    expect(schoolOrders.length).toBe(db.orders.filter((o) => o.schoolId === 'sch-stmarys').length)
    expect(schoolOrders.every((o) => o.schoolId === 'sch-stmarys')).toBe(true)
    const dates = schoolOrders.map((o) => o.orderDate)
    expect(dates).toEqual([...dates].sort().reverse())
  })
  it('rejects unknown student IDs with a typed error', async () => {
    await expect(repo.getDetail('missing')).rejects.toMatchObject({ code: 'not_found' })
  })
  it('exposes optional fields as undefined and a missing photo as undefined', async () => {
    const { student } = await repo.getDetail('stu-2') // seeded without extras or photo
    expect(student.photoUrl).toBeUndefined()
    for (const k of ['bloodGroup', 'houseName', 'houseColour', 'busRoute', 'busStoppage'] as const) expect(student[k]).toBeUndefined()
    const full = (await repo.getDetail('stu-1')).student // seeded with extras
    expect(full).toMatchObject({ bloodGroup: 'B+', houseName: 'Ashoka', houseColour: 'Red', busRoute: 'Route 2', busStoppage: 'Market Square' })
  })
  it('still resolves a student whose school record is gone (no crash, flagged unknown)', async () => {
    const orphan = { ...db.students[0], id: 'orphan', referenceNo: 'ANU-ORPHAN', schoolId: 'deleted-school' }
    db.students.push(orphan)
    const { student } = await repo.getDetail('orphan')
    expect(student).toMatchObject({ schoolName: 'Unknown school', schoolActive: false })
    db.students.pop()
  })
})

describe('editing a student', () => {
  it('updates the fields, bumps updatedAt and is visible in the list (shared database)', async () => {
    const before = { ...byRef('ANU-2026-00002') }
    const saved = await repo.update('stu-2', edit('stu-2', { name: 'Priya Edited', address: '99 Edited Road, Demo Town', bloodGroup: 'A+' }))
    expect(saved).toMatchObject({ name: 'Priya Edited', address: '99 Edited Road, Demo Town', bloodGroup: 'A+' })
    expect(saved.updatedAt >= before.updatedAt).toBe(true)
    expect((await repo.list({ ...ALL, search: 'Priya Edited' })).total).toBe(1)
    expect((await repo.list({ ...ALL, search: 'Priya Sample' })).total).toBe(0)
  })

  it('PRESERVES the reference number, school, id and submission time', async () => {
    const before = { ...db.students.find((s) => s.id === 'stu-4')! }
    // Even if a caller sneaks in forbidden fields, they are ignored.
    const sneaky = { ...edit('stu-4', { name: 'Sneha Renamed' }), referenceNo: 'ANU-HACKED', schoolId: 'sch-lotus', id: 'x', isArchived: true } as StudentEditInput
    const saved = await repo.update('stu-4', sneaky)
    expect(saved.referenceNo).toBe(before.referenceNo)
    expect(saved.schoolId).toBe('sch-sunrise')
    expect(saved.id).toBe('stu-4')
    expect(saved.submittedAt).toBe(before.submittedAt)
    expect(saved.isArchived).toBe(false)
    expect(saved.name).toBe('Sneha Renamed')
  })

  it('clears optional fields when emptied (stored as undefined)', async () => {
    const saved = await repo.update('stu-1', edit('stu-1', { bloodGroup: '', houseName: '', busRoute: undefined }))
    expect(saved.bloodGroup).toBeUndefined()
    expect(saved.houseName).toBeUndefined()
    expect(saved.busRoute).toBeUndefined()
    expect(saved.houseColour).toBe('Red') // untouched
  })

  it('rejects an admission number already used in the SAME school, leaving the record untouched', async () => {
    const other = db.students.find((s) => s.id === 'stu-2')!
    const snapshot = JSON.stringify(db.students.find((s) => s.id === 'stu-8'))
    const err = await repo.update('stu-8', edit('stu-8', { name: 'Should Not Save', admissionNo: other.admissionNo.toLowerCase() })).catch((e) => e)
    expect(err).toMatchObject({ code: 'duplicate_admission_no' })
    expect(JSON.stringify(db.students.find((s) => s.id === 'stu-8'))).toBe(snapshot) // nothing partially applied
  })

  it('allows the same admission number in a different school', async () => {
    const stm = db.students.find((s) => s.id === 'stu-2')!
    await expect(repo.update('stu-4', edit('stu-4', { admissionNo: stm.admissionNo }))).resolves.toMatchObject({ admissionNo: stm.admissionNo })
  })

  it('does not treat an archived student as a clash, and keeps an unchanged number editable', async () => {
    const archived = db.students.find((s) => s.isArchived && s.schoolId === 'sch-greenvalley')!
    await expect(repo.update('stu-3', edit('stu-3', { admissionNo: archived.admissionNo }))).resolves.toBeTruthy()
    // an unchanged number is never re-checked, so students with pre-existing duplicates remain editable
    const dup = db.students.find((s) => s.id === 'stu-5')!
    db.students.find((s) => s.id === 'stu-14')!.admissionNo = dup.admissionNo
    await expect(repo.update('stu-5', edit('stu-5', { address: 'Changed address, Demo Town' }))).resolves.toMatchObject({ address: 'Changed address, Demo Town' })
  })

  it('rejects unknown student IDs', async () => {
    await expect(repo.update('missing', edit('stu-1'))).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('archiving students', () => {
  it('removes the student from the default list but keeps the record', async () => {
    const before = await repo.list(ALL)
    const target = db.students.find((s) => s.id === 'stu-6')!
    const archived = await repo.setArchived('stu-6', true)
    expect(archived).toMatchObject({ isArchived: true, referenceNo: target.referenceNo, schoolId: target.schoolId })
    expect(archived.archivedAt).toBeTruthy()

    const after = await repo.list(ALL)
    expect(after.total).toBe(before.total - 1)
    expect(ids(after)).not.toContain('stu-6')
    expect(after.counts.archived).toBe(before.counts.archived + 1)
    expect(ids(await repo.list({ ...ALL, status: 'archived' }))).toContain('stu-6')
    expect(ids(await repo.list({ ...ALL, status: 'all' }))).toContain('stu-6')
    expect((await repo.getDetail('stu-6')).student.isArchived).toBe(true) // still openable by ID
  })

  it('never touches orders, school records or other students', async () => {
    const ordersBefore = JSON.stringify(db.orders)
    const schoolBefore = JSON.stringify(db.schools.find((s) => s.id === 'sch-sunrise'))
    const othersBefore = JSON.stringify(db.students.filter((s) => s.id !== 'stu-5'))
    const orderCount = db.orders.length
    await repo.setArchived('stu-5', true)
    expect(db.orders).toHaveLength(orderCount)
    expect(JSON.stringify(db.orders)).toBe(ordersBefore)
    expect(JSON.stringify(db.schools.find((s) => s.id === 'sch-sunrise'))).toBe(schoolBefore)
    expect(JSON.stringify(db.students.filter((s) => s.id !== 'stu-5'))).toBe(othersBefore)
    // the school's orders are still returned for the archived student's detail view
    const { schoolOrders } = await repo.getDetail('stu-5')
    expect(schoolOrders.length).toBe(db.orders.filter((o) => o.schoolId === 'sch-sunrise').length)
  })

  it('removes archived students from school and dashboard counts but never loses them', async () => {
    const activeNow = db.students.filter((s) => !s.isArchived).length
    const dash = await mockDashboardRepository.get()
    expect(dash.counts.totalStudents).toBe(activeNow)
    const sunrise = await schools.getDetail('sch-sunrise')
    expect(sunrise.studentCount).toBe(db.students.filter((s) => s.schoolId === 'sch-sunrise' && !s.isArchived).length)
    expect(db.students.length).toBeGreaterThan(activeNow) // archived rows still exist
  })

  it('restores an archived student, and archiving twice is harmless', async () => {
    await repo.setArchived('stu-8', true)
    await expect(repo.setArchived('stu-8', true)).resolves.toMatchObject({ isArchived: true })
    const restored = await repo.setArchived('stu-8', false)
    expect(restored).toMatchObject({ isArchived: false, archivedAt: undefined })
    expect(ids(await repo.list(ALL))).toContain('stu-8')
  })

  it('never reuses a reference number after archiving', async () => {
    const maxBefore = Math.max(...db.students.map((s) => Number(s.referenceNo.slice(-5))))
    const r = await repo.submit({
      schoolId: 'sch-sunrise', name: 'New Kid', fatherName: 'F', motherName: 'M', dob: '2014-01-01', className: 'Class 3', section: 'A',
      rollNo: '1', admissionNo: 'NEW-1', address: '1 Test Road, Demo', mobile: '9876543210', photo: new File(['x'], 'p.png', { type: 'image/png' }),
    })
    expect(Number(r.referenceNo.slice(-5))).toBeGreaterThan(maxBefore)
  })

  it('rejects unknown student IDs', async () => {
    await expect(repo.setArchived('missing', true)).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('public submissions flow into the admin view', () => {
  it('a new submission appears in the list with its school, optional fields, photo URL and timestamps', async () => {
    const r = await repo.submit({
      schoolId: 'sch-lotus', name: 'Fresh Student', fatherName: 'F', motherName: 'M', dob: '2014-02-02', className: 'Class 3', section: 'B',
      rollNo: '8', admissionNo: 'LIS-NEW-8', address: '8 Test Road, Demo', mobile: '9876543210', bloodGroup: 'O+', busRoute: 'Route 9',
      photo: new File(['x'], 'p.png', { type: 'image/png' }),
    })
    const found = (await repo.list({ ...ALL, search: r.referenceNo })).items[0]
    expect(found).toMatchObject({ name: 'Fresh Student', schoolId: 'sch-lotus', schoolName: 'Lotus International School', isArchived: false, bloodGroup: 'O+', busRoute: 'Route 9' })
    expect(found.photoUrl).toMatch(/^blob:/)
    expect(found.updatedAt).toBe(found.submittedAt)
    expect(found.houseName).toBeUndefined()
  })
})
