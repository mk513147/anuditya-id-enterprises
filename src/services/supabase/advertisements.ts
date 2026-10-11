import { advertisementVisibility, istDay, type AdVisibility } from '@/lib/advertisements'
import type { Advertisement, AdvertisementInput } from '@/types'
import { advertisementInputSchema, isRealDay } from '@/validations/advertisement'
import { RepositoryError } from '../errors'
import type { AdminAdvertisement, AdvertisementRepository } from '../types'
import { parseInput } from '../validate'
import { AD_COLUMNS, toAdvertisement, type AdRow } from './rows'
import { guarded, requireClient, requireId, unwrap, type Client } from './shared'

const VISIBILITIES: AdVisibility[] = ['live', 'scheduled', 'ended', 'hidden']
/** Advertisements are few; the admin list reads them whole (up to this bound) and filters with the same rules as the public site. */
const MAX_ADS = 500

const withVisibility = (ad: Advertisement, now: Date): AdminAdvertisement => ({ ...ad, visibility: advertisementVisibility(ad, now) })
const validate = (input: unknown): AdvertisementInput => {
  const v = parseInput(advertisementInputSchema, input, 'Invalid advertisement.')
  return { ...v, offer: v.offer || undefined, image: v.image || undefined, startsAt: v.startsAt, endsAt: v.endsAt }
}
const pickEditable = (ad: Advertisement): AdvertisementInput => ({
  title: ad.title, description: ad.description, offer: ad.offer, image: ad.image, icon: ad.icon, whatsappMessage: ad.whatsappMessage,
  active: ad.active, isPublished: ad.isPublished, featured: ad.featured, startsAt: ad.startsAt, endsAt: ad.endsAt,
})
const toColumns = (v: AdvertisementInput) => ({
  title: v.title,
  description: v.description,
  offer: v.offer ?? null,
  image_url: v.image ?? null,
  icon: v.icon,
  whatsapp_message: v.whatsappMessage,
  active: v.active,
  is_published: v.isPublished,
  starts_at: v.startsAt ?? null,
  ends_at: v.endsAt ?? null,
  featured: v.featured,
})

export function createSupabaseAdvertisementRepository(client: Client | null): AdvertisementRepository {
  async function one(c: Client, id: string): Promise<Advertisement> {
    const row = unwrap(await guarded(() => Promise.resolve(c.from('advertisements').select(AD_COLUMNS).eq('id', id).maybeSingle()))) as AdRow | null
    if (!row) throw new RepositoryError('not_found', 'Advertisement not found.')
    return toAdvertisement(row)
  }
  async function write(c: Client, id: string, values: Record<string, unknown>): Promise<Advertisement> {
    const row = unwrap(await guarded(() => Promise.resolve(c.from('advertisements').update(values).eq('id', id).select(AD_COLUMNS).maybeSingle()))) as AdRow | null
    if (!row) throw new RepositoryError('not_found', 'Advertisement not found.')
    return toAdvertisement(row)
  }

  return {
    /** The database decides what is live using ITS clock (`now` only matters for the demo repository). */
    async listPublic() {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('list_published_advertisements')))) as AdRow[]
      return rows.map(toAdvertisement)
    },

    async list({ search = '', published = 'all', active = 'all', visibility = 'all', runsOn, page = 1, pageSize = 10, now = new Date() } = {}) {
      if (!['all', 'published', 'draft'].includes(published) || !['all', 'enabled', 'disabled'].includes(active) || (visibility !== 'all' && !VISIBILITIES.includes(visibility))) {
        throw new RepositoryError('invalid_filter', 'One of the filters is not supported.')
      }
      if (runsOn && !isRealDay(runsOn)) throw new RepositoryError('invalid_filter', 'The date must be a real calendar date.')
      const c = requireClient(client)
      const rows = unwrap(
        await guarded(() => Promise.resolve(c.from('advertisements').select(AD_COLUMNS).order('created_at', { ascending: false }).order('id').limit(MAX_ADS))),
      ) as AdRow[]
      const ads = rows.map(toAdvertisement)
      const q = search.trim().toLowerCase()
      const matches = ads
        .map((a) => withVisibility(a, now))
        .filter((a) => published === 'all' || (published === 'published' ? a.isPublished : !a.isPublished))
        .filter((a) => active === 'all' || (active === 'enabled' ? a.active : !a.active))
        .filter((a) => visibility === 'all' || a.visibility === visibility)
        .filter((a) => !runsOn || ((!a.startsAt || istDay(a.startsAt) <= runsOn) && (!a.endsAt || istDay(a.endsAt) >= runsOn)))
        .filter((a) => !q || a.title.toLowerCase().includes(q))
      const total = matches.length
      const size = Math.max(1, pageSize)
      const totalPages = Math.max(1, Math.ceil(total / size))
      const current = Math.min(Math.max(1, page), totalPages)
      const vis = ads.map((a) => advertisementVisibility(a, now))
      return {
        items: matches.slice((current - 1) * size, current * size),
        total,
        page: current,
        pageSize: size,
        totalPages,
        counts: {
          total: ads.length,
          live: vis.filter((v) => v === 'live').length,
          scheduled: vis.filter((v) => v === 'scheduled').length,
          ended: vis.filter((v) => v === 'ended').length,
          hidden: vis.filter((v) => v === 'hidden').length,
          drafts: ads.filter((a) => !a.isPublished).length,
          disabled: ads.filter((a) => !a.active).length,
        },
      }
    },

    async getDetail(id, now = new Date()) {
      return withVisibility(await one(requireClient(client), requireId(id, 'advertisement')), now)
    },

    async create(input) {
      const c = requireClient(client)
      const clean = validate(input)
      const row = unwrap(await guarded(() => Promise.resolve(c.from('advertisements').insert(toColumns(clean)).select(AD_COLUMNS).single()))) as AdRow
      return toAdvertisement(row)
    },

    async update(id, patch) {
      const c = requireClient(client)
      const adId = requireId(id, 'advertisement')
      if (typeof patch !== 'object' || patch === null) throw new RepositoryError('invalid_input', 'Nothing to update.')
      const clean = validate({ ...pickEditable(await one(c, adId)), ...patch })
      return write(c, adId, toColumns(clean))
    },

    async setActive(id, value) {
      const c = requireClient(client)
      const adId = requireId(id, 'advertisement')
      if (typeof value !== 'boolean') throw new RepositoryError('invalid_input', 'active must be true or false.', undefined, { active: 'active must be true or false.' })
      if ((await one(c, adId)).active === value) throw new RepositoryError('no_change', `The advertisement is already ${value ? 'enabled' : 'disabled'}.`)
      return write(c, adId, { active: value })
    },

    async setPublished(id, value) {
      const c = requireClient(client)
      const adId = requireId(id, 'advertisement')
      if (typeof value !== 'boolean') throw new RepositoryError('invalid_input', 'isPublished must be true or false.', undefined, { isPublished: 'isPublished must be true or false.' })
      if ((await one(c, adId)).isPublished === value) throw new RepositoryError('no_change', `The advertisement is already ${value ? 'published' : 'a draft'}.`)
      return write(c, adId, { is_published: value })
    },
  }
}
