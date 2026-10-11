import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import { nextFreeSlug, slugify } from '@/lib/slug'
import type { Service, ServiceCategory, ServiceInput } from '@/types'
import { serviceInputSchema } from '@/validations/service'
import { RepositoryError } from '../errors'
import type { ServiceRepository } from '../types'
import { parseInput } from '../validate'
import { SERVICE_COLUMNS, toService, type ServiceRow } from './rows'
import { guarded, requireClient, requireId, unwrap, type Client } from './shared'

const CATEGORY_IDS: string[] = SERVICE_CATEGORIES.map((c) => c.id)
/** The catalogue is small (tens of rows); the admin list reads it whole, up to this bound, and filters in the browser. */
const MAX_SERVICES = 500

const validate = (input: unknown): ServiceInput => {
  const v = parseInput(serviceInputSchema, input, 'Invalid service.')
  return { ...v, category: v.category as ServiceCategory, image: v.image || undefined }
}
const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()
const editable = (s: Service): ServiceInput => ({ title: s.title, tagline: s.tagline, category: s.category, description: s.description, image: s.image, icon: s.icon, enabled: s.enabled })
const toColumns = (v: ServiceInput) => ({
  title: v.title,
  tagline: v.tagline,
  category: v.category,
  description: v.description,
  image_url: v.image ?? null,
  icon: v.icon,
  enabled: v.enabled,
})

export function createSupabaseServiceRepository(client: Client | null): ServiceRepository {
  async function all(c: Client): Promise<Service[]> {
    const rows = unwrap(await guarded(() => Promise.resolve(c.from('services').select(SERVICE_COLUMNS).order('display_order').order('title').limit(MAX_SERVICES)))) as ServiceRow[]
    return rows.map(toService)
  }
  async function one(c: Client, id: string): Promise<Service> {
    const row = unwrap(await guarded(() => Promise.resolve(c.from('services').select(SERVICE_COLUMNS).eq('id', id).maybeSingle()))) as ServiceRow | null
    if (!row) throw new RepositoryError('not_found', 'Service not found.')
    return toService(row)
  }
  function assertUniqueTitle(existing: Service[], title: string, exceptId?: string) {
    if (existing.some((s) => s.id !== exceptId && norm(s.title) === norm(title))) {
      throw new RepositoryError('duplicate_title', 'Another service already uses this name.', undefined, { title: 'Another service already uses this name.' })
    }
  }

  return {
    async listPublic() {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('list_enabled_services')))) as ServiceRow[]
      return rows.map(toService)
    },

    async list({ search = '', category = 'all', status = 'all', page = 1, pageSize = 10 } = {}) {
      if (category !== 'all' && !CATEGORY_IDS.includes(category)) throw new RepositoryError('invalid_filter', 'That category is not supported.')
      if (!['all', 'enabled', 'disabled'].includes(status)) throw new RepositoryError('invalid_filter', 'That status is not supported.')
      const services = await all(requireClient(client))
      const q = search.trim().toLowerCase()
      const matches = services
        .filter((s) => category === 'all' || s.category === category)
        .filter((s) => status === 'all' || (status === 'enabled' ? s.enabled : !s.enabled))
        .filter((s) => !q || s.title.toLowerCase().includes(q))
      const total = matches.length
      const size = Math.max(1, pageSize)
      const totalPages = Math.max(1, Math.ceil(total / size))
      const current = Math.min(Math.max(1, page), totalPages)
      const byCategory = Object.fromEntries(CATEGORY_IDS.map((cat) => [cat, services.filter((s) => s.category === cat).length])) as Record<ServiceCategory, number>
      return {
        items: matches.slice((current - 1) * size, current * size),
        total,
        page: current,
        pageSize: size,
        totalPages,
        counts: { total: services.length, enabled: services.filter((s) => s.enabled).length, disabled: services.filter((s) => !s.enabled).length, byCategory },
      }
    },

    async getDetail(id) {
      return one(requireClient(client), requireId(id, 'service'))
    },

    async create(input) {
      const c = requireClient(client)
      const clean = validate(input)
      const existing = await all(c)
      assertUniqueTitle(existing, clean.title)
      const row = unwrap(
        await guarded(() =>
          Promise.resolve(
            c
              .from('services')
              .insert({
                ...toColumns(clean),
                slug: nextFreeSlug(slugify(clean.title), existing.map((s) => s.slug)),
                display_order: Math.max(0, ...existing.map((s) => s.order)) + 1, // shown after the existing services
              })
              .select(SERVICE_COLUMNS)
              .single(),
          ),
        ),
        { unique: 'duplicate_title' },
      ) as ServiceRow
      return toService(row)
    },

    async update(id, patch) {
      const c = requireClient(client)
      const serviceId = requireId(id, 'service')
      if (typeof patch !== 'object' || patch === null) throw new RepositoryError('invalid_input', 'Nothing to update.')
      const current = await one(c, serviceId)
      // Keys present in the patch replace the stored value (undefined clears the image); everything else is kept.
      const clean = validate({ ...editable(current), ...patch })
      assertUniqueTitle(await all(c), clean.title, serviceId)
      const row = unwrap(await guarded(() => Promise.resolve(c.from('services').update(toColumns(clean)).eq('id', serviceId).select(SERVICE_COLUMNS).maybeSingle()))) as ServiceRow | null
      if (!row) throw new RepositoryError('not_found', 'Service not found.')
      return toService(row)
    },

    async setEnabled(id, enabled) {
      const c = requireClient(client)
      const serviceId = requireId(id, 'service')
      if (typeof enabled !== 'boolean') throw new RepositoryError('invalid_input', 'Enabled must be true or false.', undefined, { enabled: 'Enabled must be true or false.' })
      const current = await one(c, serviceId)
      if (current.enabled === enabled) throw new RepositoryError('no_change', `The service is already ${enabled ? 'enabled' : 'disabled'}.`)
      const row = unwrap(await guarded(() => Promise.resolve(c.from('services').update({ enabled }).eq('id', serviceId).select(SERVICE_COLUMNS).maybeSingle()))) as ServiceRow | null
      if (!row) throw new RepositoryError('not_found', 'Service not found.')
      return toService(row)
    },
  }
}
