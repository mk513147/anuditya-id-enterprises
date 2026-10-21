import { delay } from '@/lib/delay'
import { nextFreeSlug } from '@/lib/slug'
import type { School, SchoolInput } from '@/types'
import { inspectImage } from '@/validations/schoolImage'
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

/** Prototype hook: an image file whose name contains this fails to upload (to try partial batches and retry). */
export const MOCK_IMAGE_FAILURE_TOKEN = 'FAIL'

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
      .map((s) => ({ id: s.id, name: s.name })) // the public dropdown gets nothing else
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
    return school.isActive ? { status: 'active', school: { id: school.id, name: school.name, slug: school.slug } } : { status: 'inactive' }
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

  async listImages(schoolId) {
    await delay(200)
    find(schoolId)
    return db.schoolImages
      .filter((i) => i.schoolId === schoolId)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder)
      .map(({ sha256: _sha256, ...i }) => ({ ...i }))
  },

  async uploadImage(schoolId, file, { altText } = {}) {
    const check = await inspectImage(file)
    if (!check.ok) throw new RepositoryError('invalid_input', check.message, undefined, { file: check.message })
    find(schoolId)
    await delay(400)
    // Prototype hook: an image whose name contains "FAIL" fails like a dropped connection (to try partial batches and retry).
    if (file.name.toUpperCase().includes(MOCK_IMAGE_FAILURE_TOKEN)) throw new Error('Mock upload failure')
    const mine = db.schoolImages.filter((i) => i.schoolId === schoolId)
    if (mine.some((i) => i.sha256 === check.sha256)) throw new RepositoryError('duplicate_image', 'This image has already been added to this school.')
    const image = {
      id: crypto.randomUUID(),
      schoolId,
      originalName: file.name,
      mimeType: check.type.mime,
      sizeBytes: file.size,
      altText: altText?.trim() || undefined,
      isPrimary: !mine.some((i) => i.isPrimary),
      displayOrder: Math.max(-1, ...mine.map((i) => i.displayOrder)) + 1,
      createdAt: new Date().toISOString(),
      url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
      sha256: check.sha256,
    }
    db.schoolImages.push(image)
    const { sha256: _sha256, ...out } = image
    return { ...out }
  },

  async setPrimaryImage(imageId) {
    await delay(250)
    const image = db.schoolImages.find((i) => i.id === imageId)
    if (!image) throw new RepositoryError('not_found', 'Image not found.')
    if (image.isPrimary) throw new RepositoryError('no_change', 'This is already the primary image.')
    for (const i of db.schoolImages) if (i.schoolId === image.schoolId) i.isPrimary = i.id === imageId
  },

  async setActive(id, isActive) {
    await delay(400)
    const school = find(id)
    school.isActive = isActive
    school.updatedAt = new Date().toISOString()
    return { ...school }
  },
}
