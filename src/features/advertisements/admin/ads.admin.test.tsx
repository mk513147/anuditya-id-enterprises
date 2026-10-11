import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import { RepositoryError } from '@/services/errors'
import type { AdminAdvertisement } from '@/services/types'
import { advertisementFormSchema, advertisementInputSchema, toAdvertisementInput, type AdvertisementFormValues } from '@/validations/advertisement'
import { AdFilters } from './AdFilters'
import { AdPreview } from './AdPreviewDialog'
import { adColumns, adRowActions, scheduleText } from './adColumns'
import { adActionErrorMessage, publicStatusNote, toggleCopy } from './adStatus'
import { applyFieldErrors, formDefaults } from './adForm'
import { toAdListParams } from './useAdFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const noop = () => {}
const ad = (over: Partial<AdminAdvertisement> = {}): AdminAdvertisement => ({
  id: 'ad-1', title: 'School Diary 2026-27', description: 'Custom-designed diaries with your school details and calendar.', offer: 'Early booking offer',
  icon: 'diary', whatsappMessage: 'School Diary 2026-27', active: true, isPublished: true, featured: false, visibility: 'live', ...over,
})

describe('advertisement table', () => {
  const rows = [
    ad(),
    ad({ id: 'ad-2', title: 'Draft: festival offer', isPublished: false, active: true, visibility: 'hidden', offer: undefined }),
    ad({ id: 'ad-3', title: 'Old offer', visibility: 'ended', endsAt: '2026-06-30T18:29:59.000Z', startsAt: '2026-03-31T18:30:00.000Z' }),
  ]
  const html = renderToStaticMarkup(<DataTable caption="Advertisements" columns={adColumns(noop)} rows={rows} rowKey={(a) => a.id} actions={adRowActions(noop)} />)

  it('shows publication, enabled and public status as three separate things', () => {
    for (const h of ['Publication', 'Enabled', 'Public status']) expect(html, h).toContain(`>${h}</th>`)
    expect(html).toContain('Published')
    expect(html).toContain('Draft')
    expect(html).toContain('Live now')
    expect(html).toContain('Hidden')
    expect(html).toContain('Ended')
  })

  it('shows the schedule as India days', () => {
    expect(html).toContain('1 Apr 2026 – 30 Jun 2026')
    expect(html).toContain('No dates set')
  })

  it('offers labelled actions whose wording follows the current state', () => {
    expect(html).toContain('aria-label="Unpublish School Diary 2026-27"')
    expect(html).toContain('aria-label="Publish Draft: festival offer"')
    expect(html).toContain('aria-label="Disable School Diary 2026-27"')
    expect(html).toContain('aria-label="Edit Old offer"')
    expect(html).toContain('aria-label="Preview Old offer"')
  })

  it('has a caption, both layouts, and never offers a permanent delete', () => {
    expect(html).toContain('<caption class="sr-only">Advertisements</caption>')
    expect(html).toContain('<ul aria-label="Advertisements"')
    expect(html).not.toMatch(/Delete|Remove advertisement/i)
    expect(count(html, '<th ')).toBe(adColumns(noop).length + 1)
  })

  it('describes schedules in words', () => {
    expect(scheduleText({ startsAt: '2026-08-31T18:30:00.000Z' })).toBe('From 1 Sept 2026')
    expect(scheduleText({ endsAt: '2026-12-31T18:29:59.000Z' })).toBe('Until 31 Dec 2026')
    expect(scheduleText({})).toBe('No dates set')
  })
})

describe('advertisement filters', () => {
  const base = { filters: { q: '', published: 'all' as const, active: 'all' as const, visibility: 'all' as const, runsOn: '', page: 1 }, update: noop, clear: noop, hasActiveFilters: false }

  it('offers title search plus separate publication, enabled, public-status and date filters', () => {
    const html = renderToStaticMarkup(<AdFilters {...base} />)
    for (const l of ['Search by title', 'Publication', 'Enabled', 'Public status', 'Running on date']) expect(html, l).toContain(`>${l}</label>`)
    expect(html).toContain('Published and drafts')
    expect(html).toContain('Enabled and disabled')
  })

  it('shows removable chips and Clear all when filters are active', () => {
    const html = renderToStaticMarkup(
      <AdFilters {...base} hasActiveFilters filters={{ q: 'diary', published: 'draft', active: 'disabled', visibility: 'hidden', runsOn: '2026-10-01', page: 1 }} />,
    )
    for (const t of ['Search: “diary”', 'Publication: Draft', 'State: Disabled', 'Public status: Hidden (draft or disabled)', 'Running on: 1 Oct 2026', 'Clear all filters']) expect(html, t).toContain(t)
    expect(count(html, 'aria-label="Remove filter')).toBe(5)
  })

  it('maps URL filters to repository params, leaving empty ones out', () => {
    expect(toAdListParams({ q: '', published: 'all', active: 'all', visibility: 'all', runsOn: '', page: 1 })).toEqual({ search: undefined, published: 'all', active: 'all', visibility: 'all', runsOn: undefined, page: 1, pageSize: 10 })
  })
})

describe('preview and wording', () => {
  it('shows the public card plus why an advertisement is or is not public', () => {
    const live = renderToStaticMarkup(<AdPreview ad={ad()} />)
    expect(live).toContain('Live now: visitors can see this')
    expect(live).toContain('data-testid="ad-preview-card"')
    expect(live).toContain('School Diary 2026-27')
    expect(live).toContain('Early booking offer')
    const draft = renderToStaticMarkup(<AdPreview ad={ad({ isPublished: false, visibility: 'hidden' })} />)
    expect(draft).toContain('Not visible: it is a draft (not published).')
  })

  it('names every reason an advertisement is not public', () => {
    expect(publicStatusNote(ad({ visibility: 'hidden', isPublished: false, active: false }))).toBe('Not visible: it is a draft (not published) and it is disabled.')
    expect(publicStatusNote(ad({ visibility: 'hidden', active: false }))).toBe('Not visible: it is disabled.')
    expect(publicStatusNote(ad({ visibility: 'scheduled', startsAt: '2026-11-30T18:30:00.000Z' }))).toBe('Not visible yet: it starts on 1 Dec 2026.')
    expect(publicStatusNote(ad({ visibility: 'ended', endsAt: '2026-06-30T18:29:59.000Z' }))).toBe('Not visible: it ended on 30 Jun 2026.')
  })

  it('words each confirmation, marking the hiding actions as destructive', () => {
    expect(toggleCopy(ad(), 'publish')).toMatchObject({ confirm: 'Unpublish', done: 'unpublished', destructive: true })
    expect(toggleCopy(ad({ isPublished: false }), 'publish')).toMatchObject({ confirm: 'Publish', done: 'published', destructive: false })
    expect(toggleCopy(ad(), 'enable')).toMatchObject({ confirm: 'Disable', done: 'disabled', destructive: true })
    expect(toggleCopy(ad({ active: false }), 'enable')).toMatchObject({ confirm: 'Enable', done: 'enabled', destructive: false })
    expect(toggleCopy(ad(), 'publish').body).toMatch(/Nothing is deleted/)
  })

  it('turns repository failures into clear messages', () => {
    expect(adActionErrorMessage(new RepositoryError('not_found', 'x'))).toMatch(/no longer exists/)
    expect(adActionErrorMessage(new RepositoryError('no_change', 'x'))).toMatch(/already in that state/)
    expect(adActionErrorMessage(new RepositoryError('invalid_input', 'x'))).toMatch(/Nothing was changed/)
    expect(adActionErrorMessage(new Error('down'))).toMatch(/Nothing was changed/)
  })
})

describe('advertisement form rules', () => {
  const ok: AdvertisementFormValues = {
    title: 'Diwali ID card offer', description: 'Festival pricing on ID cards and lanyards.', offer: '', image: '', icon: 'id-card', whatsappMessage: 'Diwali offer',
    active: true, isPublished: false, featured: false, startDate: '', endDate: '',
  }
  const errorsFor = (over: Partial<AdvertisementFormValues>) => {
    const r = advertisementFormSchema.safeParse({ ...ok, ...over })
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))
  }

  it('accepts a minimal valid form, with empty optional fields and no dates', () => {
    expect(advertisementFormSchema.safeParse(ok).success).toBe(true)
  })

  it('validates required fields, lengths and the icon', () => {
    expect(errorsFor({ title: 'ab' }).title).toMatch(/at least 3/)
    expect(errorsFor({ title: '   ' }).title).toBeTruthy()
    expect(errorsFor({ description: 'short' }).description).toMatch(/at least 10/)
    expect(errorsFor({ whatsappMessage: '' }).whatsappMessage).toBeTruthy()
    expect(errorsFor({ offer: 'x'.repeat(61) }).offer).toMatch(/60/)
    expect(errorsFor({ icon: 'rocket' }).icon).toMatch(/listed icons/)
  })

  it('accepts only http(s) image links', () => {
    for (const good of ['https://example.com/a.jpg', 'http://example.com/a.png', '']) expect(errorsFor({ image: good }).image, good).toBeUndefined()
    for (const bad of ['example.com/a.jpg', 'javascript:alert(1)', 'ftp://x/y.png', 'data:image/png;base64,AAAA', 'not a url']) expect(errorsFor({ image: bad }).image, bad).toMatch(/http/)
  })

  it('validates dates and rejects an end before the start', () => {
    expect(errorsFor({ startDate: '2026-02-30' }).startDate).toMatch(/real date/)
    expect(errorsFor({ endDate: 'soon' }).endDate).toMatch(/real date/)
    expect(errorsFor({ startDate: '2026-11-10', endDate: '2026-11-09' }).endDate).toMatch(/not be before/)
    expect(errorsFor({ startDate: '2026-11-10', endDate: '2026-11-10' })).toEqual({})
    expect(errorsFor({ startDate: '2026-11-10' })).toEqual({})
  })

  it('converts form values to repository input: trimmed text, "not set" for empties, IST day boundaries', () => {
    const input = toAdvertisementInput({ ...ok, title: '  Diwali ID card offer ', startDate: '2026-09-01', endDate: '2026-12-31' })
    expect(input).toMatchObject({ title: 'Diwali ID card offer', offer: undefined, image: undefined, startsAt: '2026-08-31T18:30:00.000Z', endsAt: '2026-12-31T18:29:59.000Z' })
    expect(advertisementInputSchema.safeParse(input).success).toBe(true) // the form's output always satisfies the repository's rules
  })

  it('starts a new advertisement as an enabled draft, and edits start from the stored values', () => {
    expect(formDefaults()).toMatchObject({ active: true, isPublished: false, featured: false, startDate: '', endDate: '' })
    const edit = formDefaults(ad({ startsAt: '2026-08-31T18:30:00.000Z', endsAt: '2026-12-31T18:29:59.000Z', image: 'https://example.com/a.jpg', featured: true }))
    expect(edit).toMatchObject({ title: 'School Diary 2026-27', offer: 'Early booking offer', image: 'https://example.com/a.jpg', startDate: '2026-09-01', endDate: '2026-12-31', featured: true, isPublished: true })
    // an unchanged edit reproduces the stored schedule exactly
    expect(toAdvertisementInput(edit)).toMatchObject({ startsAt: '2026-08-31T18:30:00.000Z', endsAt: '2026-12-31T18:29:59.000Z' })
  })

  it('shows repository validation errors on the matching form fields', () => {
    const calls: [string, string][] = []
    const handled = applyFieldErrors(new RepositoryError('invalid_input', 'x', undefined, { endsAt: 'The end date must not be before the start date.', title: 'Bad title' }), ((name: string, err: { message: string }) => calls.push([name, err.message])) as never)
    expect(handled).toBe(true)
    expect(calls).toEqual([['endDate', 'The end date must not be before the start date.'], ['title', 'Bad title']])
    expect(applyFieldErrors(new Error('network'), (() => {}) as never)).toBe(false)
  })
})
