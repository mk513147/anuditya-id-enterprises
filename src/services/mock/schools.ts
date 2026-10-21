import { delay } from '@/lib/delay'
import { nextFreeSlug } from '@/lib/slug'
import type { School, SchoolImage, SchoolInput } from '@/types'
import { normalizeContact } from '@/validations/fileSubmission'
import { inspectImage, schoolImageSubmissionSchema } from '@/validations/schoolImage'
import { parseInput } from '../validate'
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

/**
 * The one image-storing routine for both entry points (administrator uploader and public form): the same checks and the
 * same duplicate rule (one image per school and checksum, whoever added it). Public submissions wait for review and are
 * never primary.
 */
async function storeImage(
  schoolId: string,
  file: File,
  opts: { source: 'admin' | 'public'; altText?: string; submission?: SchoolImage['submission'] },
): Promise<SchoolImage | 'already_present'> {
  const check = await inspectImage(file)
  if (!check.ok) throw new RepositoryError('invalid_input', check.message, undefined, { file: check.message })
  await delay(400)
  // Prototype hook: an image whose name contains "FAIL" fails like a dropped connection (to try partial batches and retry).
  if (file.name.toUpperCase().includes(MOCK_IMAGE_FAILURE_TOKEN)) throw new Error('Mock upload failure')
  const mine = db.schoolImages.filter((i) => i.schoolId === schoolId)
  if (mine.some((i) => i.sha256 === check.sha256)) return 'already_present'
  const isPublic = opts.source === 'public'
  const image = {
    id: crypto.randomUUID(),
    schoolId,
    originalName: file.name,
    mimeType: check.type.mime,
    sizeBytes: file.size,
    altText: opts.altText?.trim() || undefined,
    isPrimary: !isPublic && !mine.some((i) => i.isPrimary),
    displayOrder: Math.max(-1, ...mine.map((i) => i.displayOrder)) + 1,
    createdAt: new Date().toISOString(),
    url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
    reviewStatus: isPublic ? ('pending' as const) : ('approved' as const),
    source: opts.source,
    submission: opts.submission,
    sha256: check.sha256,
  }
  db.schoolImages.push(image)
  const { sha256: _sha256, ...out } = image
  return { ...out }
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
    find(schoolId)
    const image = await storeImage(schoolId, file, { source: 'admin', altText })
    if (image === 'already_present') throw new RepositoryError('duplicate_image', 'This image has already been added to this school.')
    return image
  },

  async submitImage(input, file) {
    const v = parseInput(schoolImageSubmissionSchema, { ...input, note: input.note ?? '' }, 'Please check the form.')
    const school = db.schools.find((s) => s.id === v.schoolId)
    if (!school || !school.isActive) throw new RepositoryError('school_unavailable', 'This school is not accepting submissions.')
    const image = await storeImage(v.schoolId, file, {
      source: 'public',
      submission: { contactPerson: v.contactPerson, contactDetails: normalizeContact(v.contactDetails) as string, note: v.note || undefined },
    })
    return image === 'already_present' ? 'already_present' : 'submitted'
  },

  async setPrimaryImage(imageId) {
    await delay(250)
    const image = db.schoolImages.find((i) => i.id === imageId)
    if (!image) throw new RepositoryError('not_found', 'Image not found.')
    if (image.reviewStatus !== 'approved') throw new RepositoryError('invalid_status', 'Approve this image before making it the primary image.')
    if (image.isPrimary) throw new RepositoryError('no_change', 'This is already the primary image.')
    for (const i of db.schoolImages) if (i.schoolId === image.schoolId) i.isPrimary = i.id === imageId
  },

  async reviewImage(imageId, decision) {
    await delay(250)
    const image = db.schoolImages.find((i) => i.id === imageId)
    if (!image) throw new RepositoryError('not_found', 'Image not found.')
    if (image.reviewStatus === decision) throw new RepositoryError('no_change', `This image is already ${decision}.`)
    if (image.isPrimary) throw new RepositoryError('invalid_status', 'The primary image cannot be changed here. Choose another primary image first.')
    if (image.source === 'admin' && decision === 'pending') throw new RepositoryError('invalid_input', 'Only submitted images can be sent back for review.')
    image.reviewStatus = decision
    image.reviewedAt = decision === 'pending' ? undefined : new Date().toISOString()
  },

  async pendingImageCounts() {
    await delay(150)
    const by = new Map<string, { schoolId: string; schoolName: string; count: number }>()
    for (const i of db.schoolImages.filter((x) => x.reviewStatus === 'pending')) {
      const e = by.get(i.schoolId) ?? { schoolId: i.schoolId, schoolName: db.schools.find((s) => s.id === i.schoolId)?.name ?? 'Unknown school', count: 0 }
      e.count++
      by.set(i.schoolId, e)
    }
    return [...by.values()]
  },

  async setActive(id, isActive) {
    await delay(400)
    const school = find(id)
    school.isActive = isActive
    school.updatedAt = new Date().toISOString()
    return { ...school }
  },
}
