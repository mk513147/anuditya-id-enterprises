import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import { delay } from '@/lib/delay'
import { nextFreeSlug, slugify } from '@/lib/slug'
import type { ID, Service, ServiceCategory, ServiceInput } from '@/types'
import { serviceInputSchema } from '@/validations/service'
import { RepositoryError } from '../errors'
import type { ServiceRepository } from '../types'
import { db } from './db'

const CATEGORY_IDS: string[] = SERVICE_CATEGORIES.map((c) => c.id)
const byOrder = (a: Service, b: Service) => a.order - b.order

function findById(id: ID): Service {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', 'A service id is required.')
  const service = db.services.find((s) => s.id === id)
  if (!service) throw new RepositoryError('not_found', 'Service not found.')
  return service
}

/** Validates the full set of editable fields; throws invalid_input with a message per field. Returns the cleaned input. */
function validate(input: unknown): ServiceInput {
  const parsed = serviceInputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    throw new RepositoryError('invalid_input', Object.values(fieldErrors)[0] ?? 'Invalid service.', undefined, fieldErrors)
  }
  const v = parsed.data
  return { ...v, category: v.category as ServiceCategory, image: v.image || undefined }
}

/** Quotes and WhatsApp enquiries refer to a service by its name, so names must be unique (ignoring case and spacing). */
function assertUniqueTitle(title: string, exceptId?: ID) {
  const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()
  if (db.services.some((s) => s.id !== exceptId && norm(s.title) === norm(title))) {
    throw new RepositoryError('duplicate_title', 'Another service already uses this name.', undefined, { title: 'Another service already uses this name.' })
  }
}

const editable = (s: Service): ServiceInput => ({ title: s.title, tagline: s.tagline, category: s.category, description: s.description, image: s.image, icon: s.icon, enabled: s.enabled })

function requireBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') throw new RepositoryError('invalid_input', 'Enabled must be true or false.', undefined, { enabled: 'Enabled must be true or false.' })
}

/** Single source for the Home page section, /services and the quote dialog's service list. Disabled services never leave it. */
export const mockServiceRepository: ServiceRepository = {
  async listPublic() {
    await delay()
    return db.services.filter((s) => s.enabled).sort(byOrder).map((s) => ({ ...s }))
  },

  async list({ search = '', category = 'all', status = 'all', page = 1, pageSize = 10 } = {}) {
    await delay(250)
    if (category !== 'all' && !CATEGORY_IDS.includes(category)) throw new RepositoryError('invalid_filter', 'That category is not supported.')
    if (!['all', 'enabled', 'disabled'].includes(status)) throw new RepositoryError('invalid_filter', 'That status is not supported.')

    const q = search.trim().toLowerCase()
    const matches = [...db.services]
      .sort(byOrder)
      .filter((s) => category === 'all' || s.category === category)
      .filter((s) => status === 'all' || (status === 'enabled' ? s.enabled : !s.enabled))
      .filter((s) => !q || s.title.toLowerCase().includes(q))

    const total = matches.length
    const size = Math.max(1, pageSize)
    const totalPages = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, page), totalPages)
    const byCategory = Object.fromEntries(CATEGORY_IDS.map((c) => [c, db.services.filter((s) => s.category === c).length])) as Record<ServiceCategory, number>
    return {
      items: matches.slice((current - 1) * size, current * size).map((s) => ({ ...s })),
      total,
      page: current,
      pageSize: size,
      totalPages,
      counts: { total: db.services.length, enabled: db.services.filter((s) => s.enabled).length, disabled: db.services.filter((s) => !s.enabled).length, byCategory },
    }
  },

  async getDetail(id) {
    await delay(250)
    return { ...findById(id) }
  },

  async create(input) {
    await delay(500)
    const clean = validate(input)
    assertUniqueTitle(clean.title)
    const service: Service = {
      id: `svc-${crypto.randomUUID()}`,
      slug: nextFreeSlug(slugify(clean.title), db.services.map((s) => s.slug)),
      order: Math.max(0, ...db.services.map((s) => s.order)) + 1, // shown after the existing services
      ...clean,
    }
    db.services.push(service)
    return { ...service }
  },

  async update(id, patch) {
    await delay(500)
    const service = findById(id)
    if (typeof patch !== 'object' || patch === null) throw new RepositoryError('invalid_input', 'Nothing to update.')
    // Keys present in the patch replace the stored value (undefined clears the image); everything else is kept.
    const clean = validate({ ...editable(service), ...patch })
    assertUniqueTitle(clean.title, id)
    Object.assign(service, clean) // slug, id and order are not editable and stay as they are
    if (clean.image === undefined) delete service.image
    return { ...service }
  },

  async setEnabled(id, enabled) {
    await delay(300)
    const service = findById(id)
    requireBoolean(enabled)
    if (service.enabled === enabled) throw new RepositoryError('no_change', `The service is already ${enabled ? 'enabled' : 'disabled'}.`)
    service.enabled = enabled
    return { ...service }
  },
}
