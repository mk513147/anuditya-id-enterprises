import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FEEDBACK_DATA } from '@/data/feedback'
import type { Feedback } from '@/types'
import { feedbackSchema, FEEDBACK_MESSAGE_MAX } from '@/validations/feedback'
import { RatingInput } from './RatingInput'
import { TestimonialList } from './TestimonialList'

const approved = FEEDBACK_DATA.filter((f) => f.status === 'approved')
const count = (html: string, needle: string) => html.split(needle).length - 1
const valid = { name: 'Asha Verma', organization: '', rating: 5, message: 'Lovely quality and on-time delivery.' }

describe('feedbackSchema', () => {
  it('accepts a complete submission (organisation is optional)', () => {
    expect(feedbackSchema.safeParse(valid).success).toBe(true)
    expect(feedbackSchema.safeParse({ ...valid, organization: 'Demo School' }).success).toBe(true)
  })

  it.each([
    ['name', { name: '' }, 'Please enter your name (at least 2 characters).'],
    ['name too short', { name: 'A' }, 'Please enter your name (at least 2 characters).'],
    ['name too long', { name: 'x'.repeat(61) }, 'Name must be 60 characters or fewer.'],
    ['message', { message: '' }, 'Please write at least 10 characters.'],
    ['short message', { message: 'Great' }, 'Please write at least 10 characters.'],
    ['long message', { message: 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1) }, `Please keep your feedback to ${FEEDBACK_MESSAGE_MAX} characters or fewer.`],
    ['organisation too long', { organization: 'x'.repeat(101) }, 'School or organisation must be 100 characters or fewer.'],
    ['missing rating', { rating: undefined }, 'Please choose a rating from 1 to 5.'],
    ['rating 0', { rating: 0 }, 'Please choose a rating from 1 to 5.'],
    ['rating 6', { rating: 6 }, 'Please choose a rating from 1 to 5.'],
    ['fractional rating', { rating: 3.5 }, 'Please choose a rating from 1 to 5.'],
    ['NaN rating (unchecked radios)', { rating: Number.NaN }, 'Please choose a rating from 1 to 5.'],
  ])('rejects %s with a clear message', (_label, patch, message) => {
    const r = feedbackSchema.safeParse({ ...valid, ...patch })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.message)).toContain(message)
  })

  it('trims whitespace before measuring length', () => {
    expect(feedbackSchema.safeParse({ ...valid, message: '   short   ' }).success).toBe(false)
    expect(feedbackSchema.parse({ ...valid, name: '  Asha  ' }).name).toBe('Asha')
  })

  it('collects every problem on an empty form so all errors can be shown at once', () => {
    const r = feedbackSchema.safeParse({ name: '', organization: '', message: '' })
    expect(new Set(r.error?.issues.map((i) => i.path[0]))).toEqual(new Set(['name', 'rating', 'message']))
  })
})

describe('TestimonialList', () => {
  it('renders approved testimonials with name, organisation, rating and message', () => {
    const html = renderToStaticMarkup(<TestimonialList state="ready" items={approved} />)
    expect(count(html, '<figure')).toBe(3)
    expect(html).toContain('Rajesh Kumar')
    expect(html).toContain("St. Mary&#x27;s School")
    expect(html).toContain('Rated 5 out of 5')
    expect(html).toContain('Very good quality ID cards')
  })

  it('does not render pending or rejected feedback when given only the approved list', () => {
    const html = renderToStaticMarkup(<TestimonialList state="ready" items={approved} />)
    for (const f of FEEDBACK_DATA.filter((x) => x.status !== 'approved')) {
      expect(html).not.toContain(f.message)
    }
  })

  it('omits the organisation line when there is none', () => {
    const noOrg: Feedback = { ...approved[0], organization: undefined }
    const html = renderToStaticMarkup(<TestimonialList state="ready" items={[noOrg]} />)
    expect(html).toContain(noOrg.name)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('text-xs text-muted-ink">')
  })

  it('empty state', () => {
    const html = renderToStaticMarkup(<TestimonialList state="ready" items={[]} />)
    expect(html).toContain('No feedback yet')
    expect(count(html, '<figure')).toBe(0)
  })

  it('loading state is announced', () => {
    expect(renderToStaticMarkup(<TestimonialList state="loading" />)).toContain('aria-busy="true"')
  })

  it('error state is an alert with a retry', () => {
    const html = renderToStaticMarkup(<TestimonialList state="error" onRetry={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
  })
})

describe('RatingInput', () => {
  it('renders five native radio buttons inside a labelled fieldset', () => {
    const html = renderToStaticMarkup(<RatingInput id="r" value={undefined} onChange={() => {}} />)
    expect(count(html, 'type="radio"')).toBe(5)
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
    expect(html).toContain('aria-label="1 star"')
    expect(html).toContain('aria-label="5 stars"')
    expect(html).toContain('Tap a star to rate')
  })

  it('reflects the selected value in the checked radio and in text', () => {
    const html = renderToStaticMarkup(<RatingInput id="r" value={4} onChange={() => {}} />)
    expect(count(html, 'checked=""')).toBe(1)
    expect(html).toContain('4 out of 5')
  })

  it('associates the error message with the fieldset', () => {
    const html = renderToStaticMarkup(<RatingInput id="r" value={undefined} onChange={() => {}} error="Please choose a rating from 1 to 5." />)
    expect(html).toContain('aria-describedby="r-error"')
    expect(html).toContain('id="r-error"')
    expect(html).toContain('Please choose a rating from 1 to 5.')
  })
})
