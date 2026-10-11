import { delay } from '@/lib/delay'
import { advertisementVisibility, isAdvertisementVisible, istDay, type AdVisibility } from '@/lib/advertisements'
import type { Advertisement, AdvertisementInput, ID } from '@/types'
import { advertisementInputSchema, isRealDay } from '@/validations/advertisement'
import { RepositoryError } from '../errors'
import type { AdminAdvertisement, AdvertisementRepository } from '../types'
import { db } from './db'

const VISIBILITIES: AdVisibility[] = ['live', 'scheduled', 'ended', 'hidden']

const withVisibility = (ad: Advertisement, now: Date): AdminAdvertisement => ({ ...ad, visibility: advertisementVisibility(ad, now) })

function findById(id: ID): Advertisement {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', 'An advertisement id is required.')
  const ad = db.advertisements.find((a) => a.id === id)
  if (!ad) throw new RepositoryError('not_found', 'Advertisement not found.')
  return ad
}

/** Validates the full set of editable fields; throws invalid_input with a message per field. Returns the cleaned input. */
function validate(input: unknown): AdvertisementInput {
  const parsed = advertisementInputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] ??= issue.message
    }
    throw new RepositoryError('invalid_input', Object.values(fieldErrors)[0] ?? 'Invalid advertisement.', undefined, fieldErrors)
  }
  const v = parsed.data
  return { ...v, offer: v.offer || undefined, image: v.image || undefined, startsAt: v.startsAt, endsAt: v.endsAt }
}

const pickEditable = (ad: Advertisement): AdvertisementInput => ({
  title: ad.title, description: ad.description, offer: ad.offer, image: ad.image, icon: ad.icon, whatsappMessage: ad.whatsappMessage,
  active: ad.active, isPublished: ad.isPublished, featured: ad.featured, startsAt: ad.startsAt, endsAt: ad.endsAt,
})

function requireBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw new RepositoryError('invalid_input', `${field} must be true or false.`, undefined, { [field]: `${field} must be true or false.` })
}

export const mockAdvertisementRepository: AdvertisementRepository = {
  /** Single source for the Home page section and /advertisement. Hidden ads never leave this function. */
  async listPublic(now = new Date()) {
    await delay()
    return db.advertisements.filter((a) => isAdvertisementVisible(a, now)).map((a) => ({ ...a }))
  },

  async list({ search = '', published = 'all', active = 'all', visibility = 'all', runsOn, page = 1, pageSize = 10, now = new Date() } = {}) {
    await delay(250)
    if (!['all', 'published', 'draft'].includes(published) || !['all', 'enabled', 'disabled'].includes(active) || (visibility !== 'all' && !VISIBILITIES.includes(visibility))) {
      throw new RepositoryError('invalid_filter', 'One of the filters is not supported.')
    }
    if (runsOn && !isRealDay(runsOn)) throw new RepositoryError('invalid_filter', 'The date must be a real calendar date.')

    const q = search.trim().toLowerCase()
    // Newest first: new advertisements are appended to the store, so reverse it. Public order is untouched.
    const matches = [...db.advertisements]
      .reverse()
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
    const all = db.advertisements.map((a) => advertisementVisibility(a, now))
    return {
      items: matches.slice((current - 1) * size, current * size),
      total,
      page: current,
      pageSize: size,
      totalPages,
      counts: {
        total: all.length,
        live: all.filter((v) => v === 'live').length,
        scheduled: all.filter((v) => v === 'scheduled').length,
        ended: all.filter((v) => v === 'ended').length,
        hidden: all.filter((v) => v === 'hidden').length,
        drafts: db.advertisements.filter((a) => !a.isPublished).length,
        disabled: db.advertisements.filter((a) => !a.active).length,
      },
    }
  },

  async getDetail(id, now = new Date()) {
    await delay(250)
    return withVisibility(findById(id), now)
  },

  async create(input) {
    await delay(500)
    const clean = validate(input)
    const ad: Advertisement = { id: `ad-${crypto.randomUUID()}`, ...clean }
    db.advertisements.push(ad)
    return { ...ad }
  },

  async update(id, patch) {
    await delay(500)
    const ad = findById(id)
    if (typeof patch !== 'object' || patch === null) throw new RepositoryError('invalid_input', 'Nothing to update.')
    // Keys present in the patch replace the stored value (undefined clears an optional field); others are kept.
    const clean = validate({ ...pickEditable(ad), ...patch })
    Object.assign(ad, clean)
    for (const key of ['offer', 'image', 'startsAt', 'endsAt'] as const) if (clean[key] === undefined) delete ad[key]
    return { ...ad }
  },

  async setActive(id, active) {
    await delay(300)
    const ad = findById(id)
    requireBoolean(active, 'active')
    if (ad.active === active) throw new RepositoryError('no_change', `The advertisement is already ${active ? 'enabled' : 'disabled'}.`)
    ad.active = active
    return { ...ad }
  },

  async setPublished(id, published) {
    await delay(300)
    const ad = findById(id)
    requireBoolean(published, 'isPublished')
    if (ad.isPublished === published) throw new RepositoryError('no_change', `The advertisement is already ${published ? 'published' : 'a draft'}.`)
    ad.isPublished = published
    return { ...ad }
  },
}
