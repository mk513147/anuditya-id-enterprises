import { delay } from '@/lib/delay'
import { nextFreeSlug } from '@/lib/slug'
import type { School, SchoolInput } from '@/types'
import { RepositoryError } from '../errors'
import type { SchoolRepository } from '../types'
import { db } from './db'

const clean = (input: SchoolInput): SchoolInput => ({
  name: input.name.trim(),
  slug: input.slug.trim().toLowerCase(),
  code: input.code.trim().toUpperCase(),
  contactPerson: input.contactPerson.trim(),
  phone: input.phone.trim(),
  email: input.email?.trim() || undefined,
  address: input.address?.trim() || undefined,
})

/** Enforces uniqueness the way a database UNIQUE constraint would. `exceptId` skips the school being edited. */
function assertUnique(input: SchoolInput, exceptId?: string) {
  const others = db.schools.filter((s) => s.id !== exceptId)
  if (others.some((s) => s.code.toLowerCase() === input.code.toLowerCase())) {
    throw new RepositoryError('duplicate_code', `School code ${input.code} is already used by another school.`)
  }
  if (others.some((s) => s.slug.toLowerCase() === input.slug.toLowerCase())) {
    throw new RepositoryError('duplicate_slug', `The link name "${input.slug}" is already used by another school.`, nextFreeSlug(input.slug, others.map((s) => s.slug)))
  }
}

const find = (id: string) => {
  const school = db.schools.find((s) => s.id === id)
  if (!school) throw new RepositoryError('not_found', 'School not found.')
  return school
}

export const mockSchoolRepository: SchoolRepository = {
  async list({ search = '', status = 'all' } = {}) {
    await delay(250)
    const q = search.trim().toLowerCase()
    return db.schools
      .filter((s) => (status === 'all' ? true : status === 'active' ? s.isActive : !s.isActive))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ ...s }))
  },

  async listActive() {
    await delay(300)
    return db.schools
      .filter((s) => s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ ...s }))
  },

  async getDetail(id) {
    await delay(250)
    const school = find(id)
    return {
      school: { ...school },
      studentCount: db.students.filter((s) => s.schoolId === id && !s.isArchived).length,
      orderCount: db.orders.filter((o) => o.schoolId === id).length,
      fileCount: db.files.filter((f) => f.schoolId === id).length,
    }
  },

  async resolveBySlug(slug) {
    await delay(300)
    const school = db.schools.find((s) => s.slug.toLowerCase() === slug.toLowerCase())
    if (!school) return { status: 'not_found' }
    return school.isActive ? { status: 'active', school: { ...school } } : { status: 'inactive' }
  },

  async create(input) {
    await delay(500)
    const data = clean(input)
    assertUnique(data)
    const now = new Date().toISOString()
    const school: School = { id: crypto.randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now }
    db.schools.push(school)
    return { ...school }
  },

  async update(id, input) {
    await delay(500)
    const school = find(id)
    const data = clean(input)
    assertUnique(data, id)
    Object.assign(school, data, { updatedAt: new Date().toISOString() })
    // Keep denormalised display names on this school's orders in step.
    db.orders.filter((o) => o.schoolId === id).forEach((o) => (o.customer = school.name))
    return { ...school }
  },

  async setActive(id, isActive) {
    await delay(400)
    const school = find(id)
    school.isActive = isActive
    school.updatedAt = new Date().toISOString()
    return { ...school }
  },
}
