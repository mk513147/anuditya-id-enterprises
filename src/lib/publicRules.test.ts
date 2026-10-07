import { describe, expect, it } from 'vitest'
import { buildTimeline, TIMELINE_STAGES } from '@/features/orders/timeline'
import { ORDER_STATUSES, type Advertisement } from '@/types'
import { trackOrderSchema } from '@/validations/jobStatus'
import { advertisementValidityLabel, isAdvertisementVisible } from './advertisements'
import { isValidOrderReference, normalizeOrderReference } from './orderReference'

describe('normalizeOrderReference / isValidOrderReference', () => {
  it.each([
    ['JOB-2026-0003', 'JOB-2026-0003'],
    ['  job-2026-0003  ', 'JOB-2026-0003'],
    ['job 2026 0003', 'JOB-2026-0003'],
    ['Job   2026\t0003', 'JOB-2026-0003'],
    ['-JOB-2026-0003-', 'JOB-2026-0003'],
  ])('%j -> %s', (input, expected) => expect(normalizeOrderReference(input)).toBe(expected))

  it.each(['JOB-2026-0003', 'job-2026-0003', 'ANU-2026-00021', 'ABC12'])('accepts %s', (v) => expect(isValidOrderReference(v)).toBe(true))
  it.each(['', '   ', 'JOB', '123', 'JOB_2026_0003', 'JOB/2026/0003', '<script>', 'JOB-2026-0003; DROP', 'x'.repeat(40)])('rejects %j', (v) =>
    expect(isValidOrderReference(v)).toBe(false))
})

describe('trackOrderSchema', () => {
  it('requires a reference, with a helpful message', () => {
    const r = trackOrderSchema.safeParse({ reference: '   ' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Please enter your job or order number.')
  })
  it('rejects malformed references with an example', () => {
    const r = trackOrderSchema.safeParse({ reference: 'bad ref!' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toContain('JOB-2026-0003')
  })
  it('accepts a valid reference', () => {
    expect(trackOrderSchema.safeParse({ reference: ' job-2026-0003 ' }).success).toBe(true)
  })
})

describe('buildTimeline', () => {
  const states = (s: (typeof ORDER_STATUSES)[number]) => buildTimeline(s).map((x) => x.state)

  it('always returns the seven stages in order', () => {
    for (const s of ORDER_STATUSES) {
      const stages = buildTimeline(s)
      expect(stages).toHaveLength(7)
      expect(stages.slice(0, 6).map((x) => x.label)).toEqual(TIMELINE_STAGES.slice(0, 6))
    }
  })

  it('marks completed / current / upcoming around the current status', () => {
    expect(states('Order Received')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(states('Printing')).toEqual(['completed', 'completed', 'completed', 'current', 'upcoming', 'upcoming', 'upcoming'])
    expect(states('Ready')).toEqual(['completed', 'completed', 'completed', 'completed', 'completed', 'current', 'upcoming'])
  })

  it('treats Dispatched as the current final stage, labelled "Dispatched"', () => {
    const t = buildTimeline('Dispatched')
    expect(t.slice(0, 6).every((x) => x.state === 'completed')).toBe(true)
    expect(t[6]).toEqual({ label: 'Dispatched', state: 'current' })
  })

  it('treats Delivered as everything completed, with nothing current, labelled "Delivered"', () => {
    const t = buildTimeline('Delivered')
    expect(t.every((x) => x.state === 'completed')).toBe(true)
    expect(t[6].label).toBe('Delivered')
  })

  it('keeps the combined label while the order has not reached the last stage', () => {
    expect(buildTimeline('Quality Check')[6].label).toBe('Dispatched / Delivered')
  })

  it('has exactly one current stage for every status except Delivered', () => {
    for (const s of ORDER_STATUSES) expect(states(s).filter((x) => x === 'current')).toHaveLength(s === 'Delivered' ? 0 : 1)
  })

  it('has no cancelled status in the data model, so cancelled orders cannot occur', () => {
    expect((ORDER_STATUSES as readonly string[]).some((s) => /cancel/i.test(s))).toBe(false)
  })
})

const ad = (over: Partial<Advertisement> = {}): Advertisement => ({
  id: 'a', title: 'T', description: 'D', icon: 'banner', whatsappMessage: 'T', active: true, isPublished: true, featured: false, ...over,
})
const NOW = new Date('2026-10-06T12:00:00.000Z')

describe('isAdvertisementVisible', () => {
  it('shows an enabled, published advertisement with no dates', () => expect(isAdvertisementVisible(ad(), NOW)).toBe(true))
  it('hides a disabled advertisement', () => expect(isAdvertisementVisible(ad({ active: false }), NOW)).toBe(false))
  it('hides a draft, even when enabled and inside its dates', () => {
    expect(isAdvertisementVisible(ad({ isPublished: false }), NOW)).toBe(false)
    expect(isAdvertisementVisible(ad({ isPublished: false, startsAt: '2026-01-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z' }), NOW)).toBe(false)
  })
  it('hides an expired advertisement and one that has not started', () => {
    expect(isAdvertisementVisible(ad({ endsAt: '2026-06-30T23:59:59Z' }), NOW)).toBe(false)
    expect(isAdvertisementVisible(ad({ startsAt: '2026-12-01T00:00:00Z' }), NOW)).toBe(false)
  })
  it('shows an advertisement inside its window', () => {
    expect(isAdvertisementVisible(ad({ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-12-31T23:59:59Z' }), NOW)).toBe(true)
  })
  it('treats both window edges as inclusive', () => {
    const w = ad({ startsAt: '2026-10-06T12:00:00.000Z', endsAt: '2026-10-06T12:00:00.000Z' })
    expect(isAdvertisementVisible(w, NOW)).toBe(true)
    expect(isAdvertisementVisible(w, new Date(NOW.getTime() + 1))).toBe(false)
    expect(isAdvertisementVisible(w, new Date(NOW.getTime() - 1))).toBe(false)
  })
})

describe('advertisementValidityLabel', () => {
  it('is null for an ongoing advertisement and "Valid until …" otherwise', () => {
    expect(advertisementValidityLabel(ad())).toBeNull()
    expect(advertisementValidityLabel(ad({ endsAt: '2026-12-31T12:00:00Z' }))).toMatch(/^Valid until .*2026/)
  })
})
