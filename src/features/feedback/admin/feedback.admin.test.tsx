import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import { RepositoryError } from '@/services/errors'
import type { Feedback } from '@/types'
import { FeedbackDetails } from './FeedbackDetailDialog'
import { FeedbackFilters } from './FeedbackFilters'
import { feedbackColumns, feedbackRowActions } from './feedbackColumns'
import { moderationActions, moderationErrorMessage } from './moderation'
import { toFeedbackListParams } from './useFeedbackFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const noop = () => {}
const fb = (over: Partial<Feedback> = {}): Feedback => ({
  id: 'fb-1', name: 'Rajesh Kumar', organization: "St. Mary's School", rating: 5, message: 'Very good quality ID cards and timely delivery.', status: 'pending', createdAt: '2026-08-12', ...over,
})

describe('feedback table', () => {
  const rows = [fb(), fb({ id: 'fb-2', name: 'Pooja Singh', status: 'approved', rating: 4 }), fb({ id: 'fb-3', name: 'Anonymous', status: 'rejected', rating: 1, organization: undefined })]
  const html = renderToStaticMarkup(<DataTable caption="Feedback" columns={feedbackColumns(noop)} rows={rows} rowKey={(f) => f.id} actions={feedbackRowActions(noop)} />)

  it('shows submitter, organisation, rating, message, status and date', () => {
    for (const t of ['Rajesh Kumar', 'St. Mary&#x27;s School', 'Rated 5 out of 5', 'Rated 1 out of 5', 'Very good quality ID cards', '12 Aug 2026']) expect(html, t).toContain(t)
  })

  it('shows each moderation state as text, never colour alone', () => {
    expect(html).toContain('Pending')
    expect(html).toContain('Approved')
    expect(html).toContain('Rejected')
  })

  it('has no contact-detail columns (none are collected) and a labelled review action per row', () => {
    expect(html).not.toMatch(/Phone|Email|Mobile/i)
    expect(html).toContain('aria-label="Review feedback from Pooja Singh"')
    expect(html).toContain('<caption class="sr-only">Feedback</caption>')
    expect(html).toContain('<ul aria-label="Feedback"')
    expect(count(html, '<th ')).toBe(feedbackColumns(noop).length + 1)
  })
})

describe('feedback filters', () => {
  const base = { filters: { q: '', status: 'all' as const, rating: '', page: 1 }, update: noop, clear: noop, hasActiveFilters: false }

  it('offers search, status and rating filters, all labelled', () => {
    const html = renderToStaticMarkup(<FeedbackFilters {...base} />)
    for (const l of ['Search name or message', 'Status', 'Rating']) expect(html, l).toContain(`>${l}</label>`)
    for (const v of ['pending', 'approved', 'rejected']) expect(html).toContain(`<option value="${v}"`)
    expect(html).toContain('5 stars')
    expect(html).toContain('1 star<')
  })

  it('shows removable chips and Clear all when filters are active', () => {
    const html = renderToStaticMarkup(<FeedbackFilters {...base} hasActiveFilters filters={{ q: 'quality', status: 'pending', rating: '1', page: 1 }} />)
    for (const t of ['Search: “quality”', 'Status: Pending', 'Rating: 1 star', 'Clear all filters']) expect(html, t).toContain(t)
    expect(count(html, 'aria-label="Remove filter')).toBe(3)
  })

  it('maps URL filters to repository params', () => {
    expect(toFeedbackListParams({ q: '', status: 'all', rating: '', page: 1 })).toEqual({ search: undefined, status: 'all', rating: 'all', page: 1, pageSize: 10 })
    expect(toFeedbackListParams({ q: 'x', status: 'approved', rating: '4', page: 2 }, 5)).toEqual({ search: 'x', status: 'approved', rating: 4, page: 2, pageSize: 5 })
  })
})

describe('feedback details', () => {
  it('shows only what the model holds, and whether it is public', () => {
    const html = renderToStaticMarkup(<FeedbackDetails feedback={fb()} />)
    for (const t of ['Rajesh Kumar', 'St. Mary&#x27;s School', 'Rated 5 out of 5', '12 Aug 2026', 'Pending', 'Very good quality ID cards and timely delivery.']) expect(html, t).toContain(t)
    expect(html).not.toMatch(/Phone|Email|Mobile/i)
    expect(html).toMatch(/Shown publicly<\/dt><dd[^>]*>No</)
    expect(renderToStaticMarkup(<FeedbackDetails feedback={fb({ status: 'approved' })} />)).toMatch(/Shown publicly<\/dt><dd[^>]*>Yes</)
  })

  it('says plainly when no organisation was given, and shows a real submission time', () => {
    const html = renderToStaticMarkup(<FeedbackDetails feedback={fb({ organization: undefined, createdAt: '2026-10-05T09:30:00.000Z' })} />)
    expect(html).toContain('Not given')
    expect(html).toMatch(/5 Oct 2026, \d{1,2}:\d{2}/)
  })

  it('renders the message as plain text (no markup injection)', () => {
    const html = renderToStaticMarkup(<FeedbackDetails feedback={fb({ message: '<img src=x onerror=alert(1)>' })} />)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

describe('moderation actions', () => {
  it('offers every decision except the current one, so any decision can be changed', () => {
    expect(moderationActions('pending').map((a) => a.to)).toEqual(['approved', 'rejected'])
    expect(moderationActions('approved').map((a) => a.to)).toEqual(['rejected', 'pending'])
    expect(moderationActions('rejected').map((a) => a.to)).toEqual(['approved', 'pending'])
  })

  it('explains the public effect of each decision; only rejecting is marked destructive', () => {
    const [approve] = moderationActions('pending')
    expect(approve).toMatchObject({ label: 'Approve', done: 'approved', destructive: false })
    expect(approve.confirmBody).toMatch(/Feedback page and in the Home page/)
    const reject = moderationActions('pending')[1]
    expect(reject).toMatchObject({ label: 'Reject', destructive: true })
    expect(reject.confirmBody).toMatch(/removed from the website/)
    expect(moderationActions('approved')[1]).toMatchObject({ label: 'Return to pending', done: 'returned to pending' })
  })

  it('turns every repository failure into a clear message', () => {
    expect(moderationErrorMessage(new RepositoryError('not_found', 'x'))).toMatch(/no longer exists/)
    expect(moderationErrorMessage(new RepositoryError('no_change', 'x'))).toMatch(/already had that status/)
    expect(moderationErrorMessage(new RepositoryError('invalid_status', 'x'))).toMatch(/not supported/)
    expect(moderationErrorMessage(new RepositoryError('invalid_id', 'x'))).toMatch(/could not be identified/)
    expect(moderationErrorMessage(new Error('down'))).toMatch(/Nothing was changed/)
  })
})
