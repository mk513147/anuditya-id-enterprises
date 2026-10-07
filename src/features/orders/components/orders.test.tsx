import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PublicOrder } from '@/types'
import { OrderResult } from './OrderResult'
import { OrderTimeline } from './OrderTimeline'

const count = (html: string, needle: string) => html.split(needle).length - 1
const order = (over: Partial<PublicOrder> = {}): PublicOrder => ({
  orderNo: 'JOB-2026-0003', customer: 'Sunrise Public School', service: 'School Diary', quantity: 600,
  status: 'Printing', orderDate: '2026-09-05', expectedDelivery: '2026-10-12', ...over,
})

describe('OrderTimeline rendering', () => {
  it('renders the seven stages with distinct completed / current / upcoming states', () => {
    const html = renderToStaticMarkup(<OrderTimeline status="Printing" />)
    expect(count(html, '<li ')).toBe(7)
    expect(count(html, 'data-state="completed"')).toBe(3)
    expect(count(html, 'data-state="current"')).toBe(1)
    expect(count(html, 'data-state="upcoming"')).toBe(3)
  })

  it('does not rely on colour alone: every stage has a text state and only the current one has aria-current', () => {
    const html = renderToStaticMarkup(<OrderTimeline status="Designing" />)
    expect(count(html, 'Completed')).toBe(2)
    expect(count(html, 'Current stage')).toBe(1)
    expect(count(html, 'Upcoming')).toBe(4)
    expect(count(html, 'aria-current="step"')).toBe(1)
  })

  it('shows all stages as completed and "Delivered" once delivered', () => {
    const html = renderToStaticMarkup(<OrderTimeline status="Delivered" />)
    expect(count(html, 'data-state="completed"')).toBe(7)
    expect(count(html, 'aria-current')).toBe(0)
    expect(html).toContain('Delivered')
    expect(html).not.toContain('Dispatched / Delivered')
  })

  it('shows "Dispatched" as the current final stage', () => {
    const html = renderToStaticMarkup(<OrderTimeline status="Dispatched" />)
    expect(count(html, 'data-state="completed"')).toBe(6)
    expect(html).toContain('Dispatched')
    expect(count(html, 'aria-current="step"')).toBe(1)
  })

  it('is exposed as a labelled ordered list', () => {
    const html = renderToStaticMarkup(<OrderTimeline status="Ready" />)
    expect(html).toMatch(/<ol[^>]*aria-label="Order progress"/)
  })
})

describe('OrderResult states', () => {
  it('loading: announces itself and shows no order data', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'loading' }} />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Looking up your order')
    expect(html).not.toContain('JOB-')
  })

  it('found: shows reference, status, customer, service, quantity, dates and the timeline', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'found', order: order() }} />)
    expect(html).toContain('JOB-2026-0003')
    expect(html).toContain('Printing')
    expect(html).toContain('Sunrise Public School')
    expect(html).toContain('School Diary')
    expect(html).toContain('600')
    expect(html).toContain('Order date')
    expect(html).toContain('Expected delivery')
    expect(html).toContain('Your order is being printed.')
    expect(count(html, '<li ')).toBe(7)
    expect(html).toContain('Track another order')
    expect(html).toContain('Ask about this order')
  })

  it('found + delivered: says so and no longer promises a delivery date', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'found', order: order({ status: 'Delivered' }) }} />)
    expect(html).toContain('This order has been delivered.')
    expect(html).not.toContain('Expected delivery')
  })

  it('found: never renders anything beyond the public fields', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'found', order: { ...order(), notes: 'SECRET NOTE', schoolId: 'sch-1' } as PublicOrder }} />)
    expect(html).not.toContain('SECRET NOTE')
    expect(html).not.toContain('sch-1')
  })

  it('not found: names the reference that was tried and offers a way forward', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'not-found', reference: 'JOB-9999' }} />)
    expect(html).toContain('We could not find that order')
    expect(html).toContain('JOB-9999')
    expect(html).toContain('Try another number')
    expect(html).not.toContain('Progress')
  })

  it('error: is an alert, distinguishes a system problem from a wrong number, and offers a retry', () => {
    const html = renderToStaticMarkup(<OrderResult state={{ kind: 'error', reference: 'JOB-FAIL' }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Something went wrong while checking your order')
    expect(html).toContain('not a wrong number')
    expect(html).toContain('Try Again')
    expect(html).not.toContain('could not find that order')
  })
})
