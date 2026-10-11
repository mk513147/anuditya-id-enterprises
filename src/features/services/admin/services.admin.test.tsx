import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import { RepositoryError } from '@/services/errors'
import type { Service } from '@/types'
import { serviceFormSchema, serviceInputSchema, toServiceInput, type ServiceFormValues } from '@/validations/service'
import { ServiceFilters } from './ServiceFilters'
import { serviceColumns, serviceRowActions } from './serviceColumns'
import { applyFieldErrors, formDefaults } from './serviceForm'
import { categoryLabel, publicStatusNote, serviceActionErrorMessage, toggleCopy } from './serviceStatus'
import { toServiceListParams } from './useServiceFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const noop = () => {}
const svc = (over: Partial<Service> = {}): Service => ({
  id: 'svc-1', slug: 'school-diary', category: 'school-materials', title: 'School Diary', tagline: 'Custom Design',
  description: 'Custom school diaries with calendar, rules and your own cover design.', icon: 'diary', enabled: true, order: 6, ...over,
})

describe('service table', () => {
  const rows = [svc(), svc({ id: 'svc-2', title: 'Logo Design', category: 'design-printing', enabled: false, image: 'https://example.com/l.png', order: 10 })]
  const html = renderToStaticMarkup(<DataTable caption="Services" columns={serviceColumns(noop)} rows={rows} rowKey={(s) => s.id} actions={serviceRowActions(noop)} />)

  it('shows name, short label, category, status, image state and position', () => {
    for (const t of ['School Diary', 'Custom Design', 'School Materials', 'Design &amp; Printing', 'Enabled', 'Disabled', 'Placeholder', 'Linked']) expect(html, t).toContain(t)
  })

  it('has labelled actions whose wording follows the state, and never a permanent delete', () => {
    expect(html).toContain('aria-label="Disable School Diary"')
    expect(html).toContain('aria-label="Enable Logo Design"')
    expect(html).toContain('aria-label="Edit Logo Design"')
    expect(html).toContain('aria-label="Preview School Diary"')
    expect(html).not.toMatch(/Delete|Remove service/i)
  })

  it('has a caption, both layouts and the right number of columns', () => {
    expect(html).toContain('<caption class="sr-only">Services</caption>')
    expect(html).toContain('<ul aria-label="Services"')
    expect(count(html, '<th ')).toBe(serviceColumns(noop).length + 1)
  })
})

describe('service filters', () => {
  const base = { filters: { q: '', category: 'all' as const, status: 'all' as const, page: 1 }, update: noop, clear: noop, hasActiveFilters: false }

  it('offers name search, category and status filters, all labelled', () => {
    const html = renderToStaticMarkup(<ServiceFilters {...base} />)
    for (const l of ['Search by service name', 'Category', 'Status']) expect(html, l).toContain(`>${l}</label>`)
    for (const c of ['ID Cards', 'School Materials', 'Design &amp; Printing']) expect(html, c).toContain(c)
    expect(html).toContain('Enabled and disabled')
  })

  it('shows removable chips and Clear all when filters are active', () => {
    const html = renderToStaticMarkup(<ServiceFilters {...base} hasActiveFilters filters={{ q: 'card', category: 'id-cards', status: 'disabled', page: 1 }} />)
    for (const t of ['Search: “card”', 'Category: ID Cards', 'Status: Disabled', 'Clear all filters']) expect(html, t).toContain(t)
    expect(count(html, 'aria-label="Remove filter')).toBe(3)
  })

  it('maps URL filters to repository params', () => {
    expect(toServiceListParams({ q: '', category: 'all', status: 'all', page: 1 })).toEqual({ search: undefined, category: 'all', status: 'all', page: 1, pageSize: 10 })
    expect(toServiceListParams({ q: 'x', category: 'id-cards', status: 'enabled', page: 2 }, 5)).toEqual({ search: 'x', category: 'id-cards', status: 'enabled', page: 2, pageSize: 5 })
  })
})

describe('service form rules', () => {
  const ok: ServiceFormValues = { title: 'Certificate Printing', tagline: 'Awards & Events', category: 'design-printing', description: 'Certificates for school events, printed on quality paper.', image: '', icon: 'printer', enabled: true }
  const errorsFor = (over: Partial<ServiceFormValues>) => {
    const r = serviceFormSchema.safeParse({ ...ok, ...over })
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))
  }

  it('accepts a valid form with no image', () => {
    expect(serviceFormSchema.safeParse(ok).success).toBe(true)
  })

  it('validates required fields, lengths, category and icon', () => {
    expect(errorsFor({ title: 'ab' }).title).toMatch(/at least 3/)
    expect(errorsFor({ title: '   ' }).title).toBeTruthy()
    expect(errorsFor({ title: 'x'.repeat(61) }).title).toMatch(/60/)
    expect(errorsFor({ tagline: '' }).tagline).toBeTruthy()
    expect(errorsFor({ description: 'short' }).description).toMatch(/at least 10/)
    expect(errorsFor({ description: 'x'.repeat(251) }).description).toMatch(/250/)
    expect(errorsFor({ category: 'toys' }).category).toMatch(/listed categories/)
    expect(errorsFor({ icon: 'rocket' }).icon).toMatch(/listed icons/)
  })

  it('accepts only http(s) image links and rejects unsafe schemes', () => {
    for (const good of ['https://example.com/a.jpg', 'http://example.com/a.png', '']) expect(errorsFor({ image: good }).image, good).toBeUndefined()
    for (const bad of ['example.com/a.jpg', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x/y.png', 'file:///etc/passwd', 'vbscript:x', 'not a url']) {
      expect(errorsFor({ image: bad }).image, bad).toMatch(/http/)
    }
  })

  it('converts form values to repository input: trimmed text, "not set" for an empty image', () => {
    const input = toServiceInput({ ...ok, title: '  Certificate Printing ', image: '  ' })
    expect(input).toMatchObject({ title: 'Certificate Printing', image: undefined, category: 'design-printing', enabled: true })
    expect(serviceInputSchema.safeParse(input).success).toBe(true) // the form's output always satisfies the repository's rules
  })

  it('starts a new service enabled, and edits start from the stored values', () => {
    expect(formDefaults()).toMatchObject({ enabled: true, image: '', category: 'id-cards', icon: 'id-card' })
    expect(formDefaults(svc({ image: 'https://example.com/a.jpg', enabled: false }))).toEqual({
      title: 'School Diary', tagline: 'Custom Design', category: 'school-materials', description: svc().description, image: 'https://example.com/a.jpg', icon: 'diary', enabled: false,
    })
  })

  it('shows repository validation and "name already used" errors on the matching fields', () => {
    const calls: [string, string][] = []
    const set = ((name: string, err: { message: string }) => calls.push([name, err.message])) as never
    expect(applyFieldErrors(new RepositoryError('duplicate_title', 'x', undefined, { title: 'Another service already uses this name.' }), set)).toBe(true)
    expect(applyFieldErrors(new RepositoryError('invalid_input', 'x', undefined, { image: 'Bad link', tagline: 'Bad label' }), set)).toBe(true)
    expect(calls).toEqual([['title', 'Another service already uses this name.'], ['image', 'Bad link'], ['tagline', 'Bad label']])
    expect(applyFieldErrors(new Error('network'), set)).toBe(false)
    expect(applyFieldErrors(new RepositoryError('not_found', 'x'), set)).toBe(false)
  })
})

describe('wording and error messages', () => {
  it('describes whether the public can see a service', () => {
    expect(publicStatusNote(svc())).toMatch(/Home page and the Services page, and choose it when asking for a quote/)
    expect(publicStatusNote(svc({ enabled: false }))).toMatch(/hidden from the Home page, the Services page and the quote form. Nothing is deleted/)
  })

  it('words the confirmation, marking disabling as destructive', () => {
    expect(toggleCopy(svc())).toMatchObject({ confirm: 'Disable', done: 'disabled', destructive: true })
    expect(toggleCopy(svc({ enabled: false }))).toMatchObject({ confirm: 'Enable', done: 'enabled', destructive: false })
    expect(toggleCopy(svc()).body).toMatch(/Nothing is deleted/)
  })

  it('turns repository failures into clear messages', () => {
    expect(serviceActionErrorMessage(new RepositoryError('not_found', 'x'))).toMatch(/no longer exists/)
    expect(serviceActionErrorMessage(new RepositoryError('no_change', 'x'))).toMatch(/already in that state/)
    expect(serviceActionErrorMessage(new RepositoryError('invalid_input', 'x'))).toMatch(/Nothing was changed/)
    expect(serviceActionErrorMessage(new Error('down'))).toMatch(/Nothing was changed/)
  })

  it('labels categories', () => {
    expect(categoryLabel('id-cards')).toBe('ID Cards')
    expect(categoryLabel('unknown')).toBe('unknown')
  })
})
