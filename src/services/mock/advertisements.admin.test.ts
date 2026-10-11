import { beforeEach, describe, expect, it, vi } from 'vitest'
import { advertisementVisibility, isAdvertisementVisible, istDay, istDayEnd, istDayStart } from '@/lib/advertisements'
import type { Advertisement, AdvertisementInput } from '@/types'
import { isRepositoryError, RepositoryError } from '../errors'
import { mockAdvertisementRepository as repo } from './advertisements'
import { db } from './db'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const NOW = new Date('2026-10-06T12:00:00.000Z')
const ALL = { pageSize: 100, now: NOW }
const ids = (r: { items: { id: string }[] }) => r.items.map((a) => a.id)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const publicIds = async (now = NOW) => (await repo.listPublic(now)).map((a) => a.id).sort()

const valid = (over: Partial<AdvertisementInput> = {}): AdvertisementInput => ({
  title: 'Diwali ID card offer', description: 'Festival pricing on ID cards and lanyards for schools.', icon: 'id-card', whatsappMessage: 'Diwali ID card offer',
  active: true, isPublished: true, featured: false, ...over,
})

const seed = JSON.parse(JSON.stringify(db.advertisements)) as Advertisement[]
beforeEach(() => {
  db.advertisements.splice(0, db.advertisements.length, ...(JSON.parse(JSON.stringify(seed)) as Advertisement[]))
})

describe('India date helpers', () => {
  it('maps a calendar day to IST boundaries, whatever the machine time zone', () => {
    expect(istDayStart('2026-09-01')).toBe('2026-08-31T18:30:00.000Z')
    expect(istDayEnd('2026-12-31')).toBe('2026-12-31T18:29:59.000Z') // exactly what the seeded data uses
    expect(istDay('2026-12-31T18:29:59.000Z')).toBe('2026-12-31')
    expect(istDay('2026-08-31T18:30:00.000Z')).toBe('2026-09-01')
  })

  it('round-trips every seeded schedule date', () => {
    for (const a of seed) {
      if (a.startsAt) expect(istDayStart(istDay(a.startsAt))).toBe(a.startsAt)
      if (a.endsAt) expect(istDayEnd(istDay(a.endsAt))).toBe(a.endsAt)
    }
  })

  it('visibility agrees with the public rule for every seeded ad', () => {
    for (const a of seed) expect(advertisementVisibility(a, NOW) === 'live').toBe(isAdvertisementVisible(a, NOW))
  })
})

describe('admin advertisement list', () => {
  it('lists every advertisement including hidden ones, most recently added first', async () => {
    const r = await repo.list(ALL)
    expect(r.total).toBe(8)
    expect(ids(r)).toEqual([...seed].reverse().map((a) => a.id))
    const created = await repo.create(valid())
    expect(ids(await repo.list(ALL))[0]).toBe(created.id)
  })

  it('classifies each advertisement as live, scheduled, ended or hidden', async () => {
    const by = Object.fromEntries((await repo.list(ALL)).items.map((a) => [a.id, a.visibility]))
    expect(by).toEqual({
      'ad-lanyard': 'live', 'ad-diary': 'live', 'ad-magazine': 'live', 'ad-prospectus': 'live',
      'ad-inactive': 'hidden', 'ad-draft': 'hidden', 'ad-expired': 'ended', 'ad-scheduled': 'scheduled',
    })
  })

  it('reports overall counts, independent of the filters', async () => {
    const r = await repo.list({ ...ALL, visibility: 'live' })
    expect(r.total).toBe(4)
    expect(r.counts).toEqual({ total: 8, live: 4, scheduled: 1, ended: 1, hidden: 2, drafts: 1, disabled: 1 })
  })

  it('searches by title, case-insensitive and partial', async () => {
    expect(ids(await repo.list({ ...ALL, search: 'DIARY' })).sort()).toEqual(['ad-diary', 'ad-scheduled'])
    expect((await repo.list({ ...ALL, search: 'nothing-like-this' })).total).toBe(0)
  })

  it('filters publication state and enabled state separately', async () => {
    expect(ids(await repo.list({ ...ALL, published: 'draft' }))).toEqual(['ad-draft'])
    expect((await repo.list({ ...ALL, published: 'published' })).total).toBe(7)
    expect(ids(await repo.list({ ...ALL, active: 'disabled' }))).toEqual(['ad-inactive'])
    expect((await repo.list({ ...ALL, active: 'enabled' })).total).toBe(7)
    // enabled but unpublished, and published but disabled, are different things
    expect(ids(await repo.list({ ...ALL, active: 'enabled', published: 'draft' }))).toEqual(['ad-draft'])
    expect(ids(await repo.list({ ...ALL, active: 'disabled', published: 'published' }))).toEqual(['ad-inactive'])
  })

  it('filters by visibility', async () => {
    expect(ids(await repo.list({ ...ALL, visibility: 'scheduled' }))).toEqual(['ad-scheduled'])
    expect(ids(await repo.list({ ...ALL, visibility: 'ended' }))).toEqual(['ad-expired'])
    expect((await repo.list({ ...ALL, visibility: 'hidden' })).total).toBe(2)
  })

  it('filters by a day the schedule must cover (India days, inclusive)', async () => {
    expect(ids(await repo.list({ ...ALL, runsOn: '2026-06-30' })).sort()).toEqual(expect.arrayContaining(['ad-expired']))
    expect(ids(await repo.list({ ...ALL, runsOn: '2026-07-01' }))).not.toContain('ad-expired')
    expect(ids(await repo.list({ ...ALL, runsOn: '2026-11-30' }))).toContain('ad-magazine')
    expect(ids(await repo.list({ ...ALL, runsOn: '2026-12-01' }))).not.toContain('ad-magazine')
    expect(ids(await repo.list({ ...ALL, runsOn: '2026-12-01' }))).toContain('ad-scheduled')
  })

  it('paginates and clamps out-of-range pages', async () => {
    const first = await repo.list({ now: NOW, page: 1, pageSize: 3 })
    expect([first.items.length, first.totalPages]).toEqual([3, 3])
    const last = await repo.list({ now: NOW, page: 99, pageSize: 3 })
    expect([last.page, last.items.length]).toEqual([3, 2])
  })

  it('rejects malformed filters', async () => {
    for (const bad of [{ published: 'maybe' }, { active: 'yes' }, { visibility: 'gone' }, { runsOn: 'tomorrow' }, { runsOn: '2026-02-31' }]) {
      expect(isRepositoryError(await rejection(repo.list(bad as never)), 'invalid_filter'), JSON.stringify(bad)).toBe(true)
    }
  })

  it('returns detached copies', async () => {
    const r = await repo.list(ALL)
    r.items[0].title = 'hacked'
    expect(JSON.stringify(db.advertisements)).toBe(JSON.stringify(seed))
  })
})

describe('admin advertisement detail', () => {
  it('returns one advertisement with its visibility', async () => {
    expect(await repo.getDetail('ad-expired', NOW)).toMatchObject({ id: 'ad-expired', visibility: 'ended', active: true, isPublished: true })
  })

  it('rejects a missing id (not_found) and an unusable id (invalid_id)', async () => {
    expect(isRepositoryError(await rejection(repo.getDetail('ad-nope')), 'not_found')).toBe(true)
    for (const bad of ['', '  ', undefined, null, 5]) expect(isRepositoryError(await rejection(repo.getDetail(bad as never)), 'invalid_id'), String(bad)).toBe(true)
  })
})

describe('create', () => {
  it('stores a valid advertisement with a generated id and trimmed text', async () => {
    const ad = await repo.create(valid({ title: '  Diwali ID card offer  ', offer: ' 10% off ', image: 'https://example.com/a.jpg' }))
    expect(ad.id).toMatch(/^ad-/)
    expect(ad).toMatchObject({ title: 'Diwali ID card offer', offer: '10% off', image: 'https://example.com/a.jpg', active: true, isPublished: true })
    expect(db.advertisements.at(-1)!.id).toBe(ad.id) // the one shared store
  })

  it('treats empty optional fields as "not set"', async () => {
    const ad = await repo.create(valid({ offer: '', image: '   ' }))
    expect(ad.offer).toBeUndefined()
    expect(ad.image).toBeUndefined()
  })

  it('rejects invalid input with a message per field and stores nothing', async () => {
    const before = db.advertisements.length
    const cases: [Partial<AdvertisementInput>, string][] = [
      [{ title: 'ab' }, 'title'],
      [{ title: 'x'.repeat(81) }, 'title'],
      [{ description: 'too short' }, 'description'],
      [{ description: 'x'.repeat(301) }, 'description'],
      [{ offer: 'x'.repeat(61) }, 'offer'],
      [{ image: 'not a url' }, 'image'],
      [{ image: 'javascript:alert(1)' }, 'image'],
      [{ image: 'ftp://example.com/a.jpg' }, 'image'],
      [{ image: 'data:image/png;base64,AAAA' }, 'image'],
      [{ icon: 'rocket' }, 'icon'],
      [{ whatsappMessage: '' }, 'whatsappMessage'],
      [{ startsAt: 'yesterday' }, 'startsAt'],
      [{ endsAt: '2026-13-45T00:00:00Z' }, 'endsAt'],
      [{ active: 'yes' as never }, 'active'],
      [{ isPublished: 1 as never }, 'isPublished'],
    ]
    for (const [over, field] of cases) {
      const e = await rejection(repo.create(valid(over)))
      expect(isRepositoryError(e, 'invalid_input'), JSON.stringify(over)).toBe(true)
      expect((e as RepositoryError).fieldErrors).toHaveProperty(field)
    }
    expect(db.advertisements).toHaveLength(before)
  })

  it('rejects an end before the start, accepts equal and open-ended schedules', async () => {
    const e = await rejection(repo.create(valid({ startsAt: istDayStart('2026-11-10'), endsAt: istDayEnd('2026-11-09') })))
    expect(isRepositoryError(e, 'invalid_input')).toBe(true)
    expect((e as RepositoryError).fieldErrors!.endsAt).toMatch(/not be before/)
    await expect(repo.create(valid({ startsAt: istDayStart('2026-11-10'), endsAt: istDayEnd('2026-11-10') }))).resolves.toBeTruthy()
    await expect(repo.create(valid({ startsAt: istDayStart('2026-11-10') }))).resolves.toBeTruthy()
    await expect(repo.create(valid({ endsAt: istDayEnd('2026-11-10') }))).resolves.toBeTruthy()
  })

  it('compares schedule instants correctly even when given with offsets', async () => {
    await expect(repo.create(valid({ startsAt: '2026-11-10T00:00:00+05:30', endsAt: '2026-11-09T19:00:00Z' }))).resolves.toBeTruthy() // 18:30Z → 19:00Z is later
    expect(isRepositoryError(await rejection(repo.create(valid({ startsAt: '2026-11-10T00:00:00+05:30', endsAt: '2026-11-09T18:00:00Z' }))), 'invalid_input')).toBe(true)
  })
})

describe('update', () => {
  it('changes only the fields given, keeping every other field', async () => {
    const before = JSON.parse(JSON.stringify(db.advertisements.find((a) => a.id === 'ad-magazine'))) as Advertisement
    const after = await repo.update('ad-magazine', { title: 'Annual Magazine Design 2027' })
    expect(after).toEqual({ ...before, title: 'Annual Magazine Design 2027' })
  })

  it('can clear an optional field and a schedule date on purpose', async () => {
    const after = await repo.update('ad-diary', { offer: undefined, endsAt: undefined })
    expect(after.offer).toBeUndefined()
    expect(after.endsAt).toBeUndefined()
    expect('offer' in db.advertisements.find((a) => a.id === 'ad-diary')!).toBe(false)
  })

  it('validates the merged result: a bad value leaves the stored record untouched', async () => {
    const snapshot = JSON.stringify(db.advertisements)
    expect(isRepositoryError(await rejection(repo.update('ad-diary', { title: 'x' })), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repo.update('ad-diary', { image: 'nope' })), 'invalid_input')).toBe(true)
    // moving only the start past the stored end is also an invalid range
    expect(isRepositoryError(await rejection(repo.update('ad-diary', { startsAt: istDayStart('2027-06-01') })), 'invalid_input')).toBe(true)
    expect(JSON.stringify(db.advertisements)).toBe(snapshot)
  })

  it('rejects missing and unusable ids', async () => {
    expect(isRepositoryError(await rejection(repo.update('ad-nope', { title: 'Valid title' })), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.update('', { title: 'Valid title' })), 'invalid_id')).toBe(true)
  })

  it('all seeded advertisements are valid under the same rules', async () => {
    for (const a of seed) await expect(repo.update(a.id, { title: a.title }), a.id).resolves.toBeTruthy()
  })
})

describe('publish / enable actions', () => {
  it('unpublishing and publishing change only the published flag', async () => {
    const before = { ...db.advertisements.find((a) => a.id === 'ad-lanyard')! }
    expect(await repo.setPublished('ad-lanyard', false)).toEqual({ ...before, isPublished: false })
    expect(await repo.setPublished('ad-lanyard', true)).toEqual(before)
  })

  it('disabling and enabling change only the active flag', async () => {
    const before = { ...db.advertisements.find((a) => a.id === 'ad-lanyard')! }
    expect(await repo.setActive('ad-lanyard', false)).toEqual({ ...before, active: false })
    expect(await repo.setActive('ad-lanyard', true)).toEqual(before)
  })

  it('rejects unchanged values, non-booleans, and missing or invalid ids', async () => {
    expect(isRepositoryError(await rejection(repo.setPublished('ad-lanyard', true)), 'no_change')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setActive('ad-inactive', false)), 'no_change')).toBe(true)
    for (const bad of ['true', 1, null, undefined]) {
      expect(isRepositoryError(await rejection(repo.setActive('ad-lanyard', bad as never)), 'invalid_input'), String(bad)).toBe(true)
      expect(isRepositoryError(await rejection(repo.setPublished('ad-lanyard', bad as never)), 'invalid_input'), String(bad)).toBe(true)
    }
    expect(isRepositoryError(await rejection(repo.setActive('nope', true)), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setPublished('', true)), 'invalid_id')).toBe(true)
    expect(db.advertisements.find((a) => a.id === 'ad-lanyard')).toMatchObject({ active: true, isPublished: true })
  })
})

describe('public visibility after admin changes (shared store)', () => {
  it('starts with the four public advertisements', async () => {
    expect(await publicIds()).toEqual(['ad-diary', 'ad-lanyard', 'ad-magazine', 'ad-prospectus'])
  })

  it('unpublishing or disabling hides an ad publicly at once; undoing it brings it back', async () => {
    await repo.setPublished('ad-diary', false)
    expect(await publicIds()).not.toContain('ad-diary')
    await repo.setPublished('ad-diary', true)
    expect(await publicIds()).toContain('ad-diary')
    await repo.setActive('ad-diary', false)
    expect(await publicIds()).not.toContain('ad-diary')
  })

  it('publishing or enabling a draft / disabled ad shows it', async () => {
    await repo.setPublished('ad-draft', true)
    expect(await publicIds()).toContain('ad-draft')
    await repo.setActive('ad-inactive', true)
    expect(await publicIds()).toContain('ad-inactive')
  })

  it('a new advertisement is public only when enabled, published and inside its dates', async () => {
    const live = await repo.create(valid())
    const draft = await repo.create(valid({ isPublished: false }))
    const off = await repo.create(valid({ active: false }))
    const future = await repo.create(valid({ startsAt: istDayStart('2026-12-25') }))
    const past = await repo.create(valid({ endsAt: istDayEnd('2026-09-30') }))
    const pub = await publicIds()
    expect(pub).toContain(live.id)
    for (const hidden of [draft, off, future, past]) expect(pub).not.toContain(hidden.id)
  })

  it('draft, disabled, future and expired seeds stay hidden', async () => {
    const pub = await publicIds()
    for (const id of ['ad-draft', 'ad-inactive', 'ad-scheduled', 'ad-expired']) expect(pub).not.toContain(id)
  })

  it('keeps the India day boundaries: live through 23:59:59 IST of the end day, hidden one second later', async () => {
    const ad = await repo.create(valid({ endsAt: istDayEnd('2026-10-10') }))
    expect(await publicIds(new Date('2026-10-10T18:29:59.000Z'))).toContain(ad.id)
    expect(await publicIds(new Date('2026-10-10T18:30:00.000Z'))).not.toContain(ad.id)
    const later = await repo.create(valid({ startsAt: istDayStart('2026-10-20') }))
    expect(await publicIds(new Date('2026-10-19T18:29:59.000Z'))).not.toContain(later.id)
    expect(await publicIds(new Date('2026-10-19T18:30:00.000Z'))).toContain(later.id)
  })

  it('editing the schedule changes public visibility', async () => {
    await repo.update('ad-expired', { endsAt: istDayEnd('2026-12-31') })
    expect(await publicIds()).toContain('ad-expired')
  })

  it('the admin view and the public view agree on what is live', async () => {
    await repo.setActive('ad-magazine', false)
    await repo.create(valid({ title: 'Another live offer' }))
    const live = ids(await repo.list({ ...ALL, visibility: 'live' })).sort()
    expect(live).toEqual(await publicIds())
  })

  it('public results never include admin-only fields', async () => {
    for (const a of await repo.listPublic(NOW)) expect(a).not.toHaveProperty('visibility')
  })
})
