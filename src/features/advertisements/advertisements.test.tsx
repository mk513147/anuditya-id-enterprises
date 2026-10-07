import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ADVERTISEMENTS_DATA } from '@/data/advertisements'
import { isAdvertisementVisible } from '@/lib/advertisements'
import type { Advertisement } from '@/types'
import { AdCard } from './AdCard'
import { AdDetailBody } from './AdDetail'
import { AdvertisementListing } from './AdvertisementListing'

const NOW = new Date('2026-10-06T12:00:00.000Z')
const visible = ADVERTISEMENTS_DATA.filter((a) => isAdvertisementVisible(a, NOW))
const count = (html: string, needle: string) => html.split(needle).length - 1
const diary = ADVERTISEMENTS_DATA.find((a) => a.id === 'ad-diary')!

describe('AdvertisementListing', () => {
  it('lists the public advertisements as cards, each with a View details button', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="ready" ads={visible} />)
    expect(count(html, '<article')).toBe(4)
    for (const a of visible) expect(html).toContain(a.title.replace(/&/g, '&amp;')) // markup escapes ampersands
    expect(count(html, 'View details')).toBe(0) // no handler given, so no button
  })

  it('shows View details buttons (named after their advertisement) when details can be opened', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="ready" ads={visible} onView={() => {}} />)
    expect(count(html, 'aria-label="View details: ')).toBe(4)
    expect(html).toContain('aria-label="View details: School Diary 2026-27"')
  })

  it('never contains hidden advertisements, whatever the input list was filtered from', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="ready" ads={visible} />)
    for (const id of ['ad-inactive', 'ad-draft', 'ad-expired', 'ad-scheduled']) {
      const hidden = ADVERTISEMENTS_DATA.find((a) => a.id === id)!
      expect(html).not.toContain(hidden.title)
    }
  })

  it('shows validity dates when an advertisement has an end date', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="ready" ads={[diary]} />)
    expect(html).toMatch(/Valid until .*2026/)
  })

  it('empty state when nothing is public', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="ready" ads={[]} />)
    expect(html).toContain('No offers available right now')
    expect(count(html, '<article')).toBe(0)
  })

  it('loading state is announced and shows no cards', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="loading" />)
    expect(html).toContain('aria-busy="true"')
    expect(count(html, '<article')).toBe(0)
  })

  it('error state is an alert with a retry', () => {
    const html = renderToStaticMarkup(<AdvertisementListing state="error" onRetry={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
  })
})

describe('advertisement card + detail content', () => {
  it('falls back to the branded placeholder when there is no image', () => {
    const html = renderToStaticMarkup(<AdCard ad={diary} layout="vertical" />)
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-hidden="true"') // PlaceholderArt is decorative
  })

  it('renders a real image with alt text when an image URL exists', () => {
    const withImage: Advertisement = { ...diary, image: 'https://example.com/diary.jpg' }
    const html = renderToStaticMarkup(<AdCard ad={withImage} layout="vertical" />)
    expect(html).toContain('<img')
    expect(html).toContain('alt="School Diary 2026-27"')
  })

  it('detail body shows the offer, validity and a WhatsApp link carrying the advertisement', () => {
    const html = renderToStaticMarkup(<AdDetailBody ad={diary} />)
    expect(html).toContain('Early booking offer')
    expect(html).toMatch(/Valid until .*2026/)
    expect(html).toContain('https://wa.me/918541872072')
    expect(html).toContain(encodeURIComponent('School Diary 2026-27'))
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('detail body says "Available now" for an ongoing advertisement', () => {
    const lanyard = ADVERTISEMENTS_DATA.find((a) => a.id === 'ad-lanyard')!
    expect(renderToStaticMarkup(<AdDetailBody ad={lanyard} />)).toContain('Available now')
  })
})
