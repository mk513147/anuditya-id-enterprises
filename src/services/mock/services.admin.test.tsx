import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { waMessages, whatsappUrl } from '@/lib/whatsapp'
import { quoteSchema } from '@/validations/quote'
import type { Service, ServiceInput } from '@/types'
import { isRepositoryError, RepositoryError } from '../errors'
import { db } from './db'
import { mockServiceRepository as repo } from './index'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const ALL = { pageSize: 100 }
const ids = (r: { items: { id: string }[] }) => r.items.map((s) => s.id)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const publicTitles = async () => (await repo.listPublic()).map((s) => s.title)

const valid = (over: Partial<ServiceInput> = {}): ServiceInput => ({
  title: 'Certificate Printing', tagline: 'Awards & Events', category: 'design-printing', description: 'Certificates for school events, printed on quality paper.', icon: 'printer', enabled: true, ...over,
})

const seed = JSON.parse(JSON.stringify(db.services)) as Service[]
beforeEach(() => {
  db.services.splice(0, db.services.length, ...(JSON.parse(JSON.stringify(seed)) as Service[]))
})

describe('admin service list', () => {
  it('lists every service (including disabled ones) in display order', async () => {
    const r = await repo.list(ALL)
    expect(r.total).toBe(12)
    expect(r.items.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    await repo.setEnabled('svc-logo', false)
    expect((await repo.list(ALL)).total).toBe(12)
  })

  it('reports overall counts, independent of the filters', async () => {
    await repo.setEnabled('svc-logo', false)
    const r = await repo.list({ ...ALL, category: 'id-cards' })
    expect(r.total).toBe(5)
    expect(r.counts).toEqual({ total: 12, enabled: 11, disabled: 1, byCategory: { 'id-cards': 5, 'school-materials': 4, 'design-printing': 3 } })
  })

  it('searches by service name, case-insensitive and partial', async () => {
    expect(ids(await repo.list({ ...ALL, search: 'ID CARD' }))).toEqual(['svc-student-id', 'svc-staff-id', 'svc-school-id', 'svc-college-id'])
    expect(ids(await repo.list({ ...ALL, search: 'diary' }))).toEqual(['svc-diary'])
    expect((await repo.list({ ...ALL, search: 'zzz' })).total).toBe(0)
  })

  it('filters by category and by enabled state, and combines them', async () => {
    expect((await repo.list({ ...ALL, category: 'school-materials' })).total).toBe(4)
    await repo.setEnabled('svc-diary', false)
    expect(ids(await repo.list({ ...ALL, status: 'disabled' }))).toEqual(['svc-diary'])
    expect((await repo.list({ ...ALL, status: 'enabled' })).total).toBe(11)
    expect(ids(await repo.list({ ...ALL, category: 'school-materials', status: 'enabled' }))).toEqual(['svc-magazine', 'svc-prospectus', 'svc-group-photo'])
    expect((await repo.list({ ...ALL, category: 'id-cards', status: 'disabled' })).total).toBe(0)
  })

  it('paginates and clamps out-of-range pages', async () => {
    const first = await repo.list({ page: 1, pageSize: 5 })
    expect([first.items.length, first.totalPages]).toEqual([5, 3])
    const last = await repo.list({ page: 99, pageSize: 5 })
    expect([last.page, last.items.length]).toEqual([3, 2])
    expect(new Set([...ids(first), ...ids(await repo.list({ page: 2, pageSize: 5 })), ...ids(last)]).size).toBe(12)
  })

  it('rejects malformed filters', async () => {
    for (const bad of [{ category: 'toys' }, { status: 'maybe' }]) {
      expect(isRepositoryError(await rejection(repo.list(bad as never)), 'invalid_filter'), JSON.stringify(bad)).toBe(true)
    }
  })

  it('returns detached copies', async () => {
    const r = await repo.list(ALL)
    r.items[0].title = 'hacked'
    expect(JSON.stringify(db.services)).toBe(JSON.stringify(seed))
  })
})

describe('admin service detail', () => {
  it('returns one service', async () => {
    expect(await repo.getDetail('svc-diary')).toMatchObject({ title: 'School Diary', category: 'school-materials', enabled: true })
  })

  it('rejects a missing id (not_found) and an unusable id (invalid_id)', async () => {
    expect(isRepositoryError(await rejection(repo.getDetail('svc-nope')), 'not_found')).toBe(true)
    for (const bad of ['', '  ', undefined, null, 4]) expect(isRepositoryError(await rejection(repo.getDetail(bad as never)), 'invalid_id'), String(bad)).toBe(true)
  })
})

describe('create', () => {
  it('stores a valid service with generated id, slug and the next display order', async () => {
    const s = await repo.create(valid({ title: '  Certificate Printing  ', image: 'https://example.com/c.jpg' }))
    expect(s).toMatchObject({ title: 'Certificate Printing', slug: 'certificate-printing', order: 13, image: 'https://example.com/c.jpg', enabled: true })
    expect(s.id).toMatch(/^svc-/)
    expect(db.services.at(-1)!.id).toBe(s.id) // the one shared store
  })

  it('treats an empty image as "not set" and keeps slugs unique', async () => {
    const a = await repo.create(valid({ image: '' }))
    expect(a.image).toBeUndefined()
    const b = await repo.create(valid({ title: 'Certificate-Printing!' })) // different name, same base slug
    expect(b.slug).toBe('certificate-printing-2')
  })

  it('rejects invalid input with a message per field and stores nothing', async () => {
    const before = JSON.stringify(db.services)
    const cases: [Partial<ServiceInput>, string][] = [
      [{ title: 'ab' }, 'title'], [{ title: 'x'.repeat(61) }, 'title'], [{ title: '   ' }, 'title'],
      [{ tagline: 'x' }, 'tagline'], [{ tagline: 'x'.repeat(41) }, 'tagline'],
      [{ category: 'toys' as never }, 'category'],
      [{ description: 'short' }, 'description'], [{ description: 'x'.repeat(251) }, 'description'],
      [{ image: 'not a url' }, 'image'], [{ image: 'javascript:alert(1)' }, 'image'], [{ image: 'data:image/png;base64,AAAA' }, 'image'],
      [{ image: 'ftp://example.com/a.png' }, 'image'], [{ image: 'vbscript:x' }, 'image'], [{ image: 'file:///etc/passwd' }, 'image'],
      [{ icon: 'rocket' }, 'icon'], [{ enabled: 'yes' as never }, 'enabled'],
    ]
    for (const [over, field] of cases) {
      const e = await rejection(repo.create(valid(over)))
      expect(isRepositoryError(e, 'invalid_input'), JSON.stringify(over)).toBe(true)
      expect((e as RepositoryError).fieldErrors).toHaveProperty(field)
    }
    expect(JSON.stringify(db.services)).toBe(before)
  })

  it('accepts http and https image links', async () => {
    await expect(repo.create(valid({ title: 'Plain http', image: 'http://example.com/a.png' }))).resolves.toBeTruthy()
    await expect(repo.create(valid({ title: 'Secure https', image: 'https://example.com/a.png' }))).resolves.toBeTruthy()
  })

  it('rejects a duplicate name (ignoring case and spacing), because enquiries refer to services by name', async () => {
    for (const title of ['student id card', '  STUDENT   ID  CARD ']) {
      const e = await rejection(repo.create(valid({ title })))
      expect(isRepositoryError(e, 'duplicate_title'), title).toBe(true)
      expect((e as RepositoryError).fieldErrors).toHaveProperty('title')
    }
    expect(db.services).toHaveLength(12)
  })

  it('a failed attempt can simply be retried with corrected input', async () => {
    expect(isRepositoryError(await rejection(repo.create(valid({ image: 'nope' }))), 'invalid_input')).toBe(true)
    await expect(repo.create(valid({ image: 'https://example.com/ok.png' }))).resolves.toBeTruthy()
    expect(db.services).toHaveLength(13)
  })
})

describe('update', () => {
  it('changes only the fields given, keeping every other field, slug and order', async () => {
    const before = JSON.parse(JSON.stringify(db.services.find((s) => s.id === 'svc-diary'))) as Service
    const after = await repo.update('svc-diary', { tagline: 'Fully Custom' })
    expect(after).toEqual({ ...before, tagline: 'Fully Custom' })
  })

  it('renaming keeps the slug and the display position', async () => {
    const after = await repo.update('svc-magazine', { title: 'Annual Magazine' })
    expect(after).toMatchObject({ title: 'Annual Magazine', slug: 'magazine', order: 7 })
  })

  it('can set and clear the image on purpose', async () => {
    expect((await repo.update('svc-logo', { image: 'https://example.com/l.png' })).image).toBe('https://example.com/l.png')
    const cleared = await repo.update('svc-logo', { image: undefined })
    expect(cleared.image).toBeUndefined()
    expect('image' in db.services.find((s) => s.id === 'svc-logo')!).toBe(false)
  })

  it('can move a service to another category', async () => {
    expect((await repo.update('svc-logo', { category: 'id-cards' })).category).toBe('id-cards')
  })

  it('validates the merged result; a bad value leaves the stored record untouched', async () => {
    const snapshot = JSON.stringify(db.services)
    expect(isRepositoryError(await rejection(repo.update('svc-diary', { title: 'x' })), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repo.update('svc-diary', { image: 'javascript:alert(1)' })), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repo.update('svc-diary', { enabled: 'no' as never })), 'invalid_input')).toBe(true)
    expect(JSON.stringify(db.services)).toBe(snapshot)
  })

  it('allows keeping the own name but rejects taking another service’s name', async () => {
    await expect(repo.update('svc-diary', { title: 'school diary' })).resolves.toBeTruthy() // same service, different case
    expect(isRepositoryError(await rejection(repo.update('svc-diary', { title: 'Magazine' })), 'duplicate_title')).toBe(true)
    expect(db.services.find((s) => s.id === 'svc-diary')!.title).toBe('school diary')
  })

  it('rejects missing and unusable ids', async () => {
    expect(isRepositoryError(await rejection(repo.update('svc-nope', { tagline: 'Valid label' })), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.update('', { tagline: 'Valid label' })), 'invalid_id')).toBe(true)
  })

  it('every seeded service is valid under the same rules', async () => {
    for (const s of seed) await expect(repo.update(s.id, { title: s.title }), s.id).resolves.toBeTruthy()
  })
})

describe('enable / disable', () => {
  it('changes only the enabled flag, and is reversible (services are never deleted)', async () => {
    const before = { ...db.services.find((s) => s.id === 'svc-banner')! }
    expect(await repo.setEnabled('svc-banner', false)).toEqual({ ...before, enabled: false })
    expect(await repo.setEnabled('svc-banner', true)).toEqual(before)
    expect(db.services).toHaveLength(12)
  })

  it('rejects unchanged values, non-booleans, and missing or invalid ids', async () => {
    expect(isRepositoryError(await rejection(repo.setEnabled('svc-banner', true)), 'no_change')).toBe(true)
    for (const bad of ['true', 1, null, undefined]) expect(isRepositoryError(await rejection(repo.setEnabled('svc-banner', bad as never)), 'invalid_input'), String(bad)).toBe(true)
    expect(isRepositoryError(await rejection(repo.setEnabled('nope', false)), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setEnabled('', false)), 'invalid_id')).toBe(true)
    expect(db.services.find((s) => s.id === 'svc-banner')!.enabled).toBe(true)
  })
})

describe('public services after admin changes (shared store; Home, /services and the quote list all read listPublic)', () => {
  it('starts with the twelve seeded services, in order', async () => {
    const pub = await repo.listPublic()
    expect(pub).toHaveLength(12)
    expect(pub.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('a new enabled service appears publicly (last), with all its details', async () => {
    const created = await repo.create(valid({ image: 'https://example.com/c.jpg' }))
    const pub = await repo.listPublic()
    expect(pub.at(-1)).toMatchObject({ id: created.id, title: 'Certificate Printing', tagline: 'Awards & Events', category: 'design-printing', image: 'https://example.com/c.jpg', icon: 'printer' })
  })

  it('a new service created disabled stays hidden until it is enabled', async () => {
    const s = await repo.create(valid({ enabled: false }))
    expect(await publicTitles()).not.toContain('Certificate Printing')
    await repo.setEnabled(s.id, true)
    expect(await publicTitles()).toContain('Certificate Printing')
  })

  it('an edit changes the public representation at once', async () => {
    await repo.update('svc-diary', { title: 'Premium School Diary', description: 'A brand new description for the diary.' })
    const diary = (await repo.listPublic()).find((s) => s.id === 'svc-diary')!
    expect(diary).toMatchObject({ title: 'Premium School Diary', description: 'A brand new description for the diary.' })
  })

  it('moving a service to another category changes the public category grouping', async () => {
    await repo.update('svc-logo', { category: 'id-cards' })
    expect((await repo.listPublic()).filter((s) => s.category === 'id-cards')).toHaveLength(6)
  })

  it('disabling hides a service from every public listing, and enabling brings it back in its old place', async () => {
    await repo.setEnabled('svc-staff-id', false)
    const pub = await repo.listPublic()
    expect(pub.find((s) => s.id === 'svc-staff-id')).toBeUndefined()
    expect(pub).toHaveLength(11)
    await repo.setEnabled('svc-staff-id', true)
    expect((await repo.listPublic()).map((s) => s.id).indexOf('svc-staff-id')).toBe(1)
  })

  it('the admin view and the public view agree on what is enabled', async () => {
    await repo.setEnabled('svc-logo', false)
    await repo.create(valid())
    const enabled = ids(await repo.list({ ...ALL, status: 'enabled' }))
    expect((await repo.listPublic()).map((s) => s.id)).toEqual(enabled)
  })

  it('public reads cannot alter the store, and listing never reorders the shared seed data', async () => {
    const pub = await repo.listPublic()
    pub[0].title = 'hacked'
    pub.reverse()
    expect(JSON.stringify(db.services)).toBe(JSON.stringify(seed))
  })
})

describe('public quote and WhatsApp enquiry flows (regression)', () => {
  it('quote form still validates, and accepts any service name offered by the public list', async () => {
    await repo.create(valid())
    for (const s of await repo.listPublic()) {
      expect(quoteSchema.safeParse({ name: 'Asha', mobile: '9876543210', service: s.title }).success, s.title).toBe(true)
    }
    expect(quoteSchema.safeParse({ name: 'A', mobile: '123', service: '' }).success).toBe(false)
  })

  it('the WhatsApp enquiry for a service names it, including a newly created one', async () => {
    const created = await repo.create(valid({ title: 'Certificate Printing' }))
    const url = whatsappUrl(waMessages.quote(created.title))
    expect(waMessages.quote(created.title)).toContain('Certificate Printing')
    expect(decodeURIComponent(url)).toContain('Certificate Printing')
    expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
  })

  it('a disabled service is no longer offered for enquiries', async () => {
    await repo.setEnabled('svc-diary', false)
    expect(await publicTitles()).not.toContain('School Diary')
  })
})

describe('duplicate-submission guard (useSingleFlight)', () => {
  type Run = (task: () => Promise<void>) => Promise<void>
  /** Renders a tiny component just to obtain the hook's callback (there is no browser-like test environment). */
  function guard(): Run {
    const found: Run[] = []
    const Probe = ({ sink }: { sink: Run[] }) => {
      sink.push(useSingleFlight())
      return null
    }
    renderToStaticMarkup(<Probe sink={found} />)
    return found[0]
  }

  it('runs the task once when called several times in the same tick', async () => {
    const run = guard()
    let runs = 0
    const task = async () => {
      runs++
      await new Promise((r) => setTimeout(r, 10))
    }
    await Promise.all([run(task), run(task), run(task)])
    expect(runs).toBe(1)
  })

  it('allows another run after the first has finished, even after a failure', async () => {
    const run = guard()
    let runs = 0
    await run(async () => { runs++ })
    await expect(run(async () => { runs++; throw new Error('boom') })).rejects.toThrow('boom')
    await run(async () => { runs++ })
    expect(runs).toBe(3)
  })

  it('three simultaneous creates through the guard store exactly one service', async () => {
    const run = guard()
    const save = () => run(async () => { await repo.create(valid()) })
    await Promise.all([save(), save(), save()])
    expect(db.services.filter((s) => s.title === 'Certificate Printing')).toHaveLength(1)
  })
})
