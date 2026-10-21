/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '@/lib/navigation'
import { SiteHeader } from './SiteHeader'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const html = renderToStaticMarkup(
  <MemoryRouter>
    <SiteHeader />
  </MemoryRouter>,
)
const navHtml = html.slice(html.indexOf('<nav aria-label="Main"'), html.indexOf('</nav>') + 6)

describe('desktop header layout (regression: labels wrapped at 1536px and wider)', () => {
  it('keeps every route in the desktop navigation, in order', () => {
    const labels = [...navHtml.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1])
    expect(labels).toEqual(NAV_ITEMS.map((n) => n.label))
    for (const n of NAV_ITEMS) expect(navHtml).toContain(`href="${n.to}"`)
  })

  it('never wraps a navigation label', () => {
    const classes = [...navHtml.matchAll(/<a [^>]*class="([^"]+)"/g)].map((m) => m[1])
    expect(classes).toHaveLength(NAV_ITEMS.length)
    for (const c of classes) expect(c).toContain('whitespace-nowrap')
  })

  it('does not widen the navigation at breakpoints where the header row cannot grow', () => {
    // The row is capped at max-w-7xl for every desktop width, so 2xl padding/gap increases only take space away.
    expect(navHtml).not.toMatch(/2xl:(px|gap|mx|ml|mr)-/)
    expect(navHtml).toMatch(/<nav aria-label="Main" class="[^"]*\bshrink-0\b/)
  })

  it('keeps the phone number on one line and the contact controls from shrinking', () => {
    expect(html).toMatch(/whitespace-nowrap[^"]*2xl:inline|2xl:inline[^"]*whitespace-nowrap/)
    expect(html).toMatch(/class="hidden shrink-0 items-center gap-2 xl:flex"/)
  })

  it('uses the responsive logo: compact below xl, the full logo from xl up', () => {
    expect(html).toMatch(/<source media="\(min-width: 1280px\)"/)
    expect(html).toContain('aria-label="Anuditya ID Solutions – home"')
  })
})

describe('browser tab icon', () => {
  it('a real /favicon.ico exists (an SPA rewrite would otherwise answer /favicon.ico with the HTML page)', () => {
    const ico = fs.readFileSync(path.join(ROOT, 'public/favicon.ico'))
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]) // ICO header: reserved 0, type 1 (icon)
    expect(ico.readUInt16LE(4)).toBe(3) // 16, 32 and 48 px images
  })

  it('declares each icon once, versioned, with no leftover shortcut-icon or placeholder declarations', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    expect(index.match(/rel="icon"/g)).toHaveLength(2)
    expect(index).not.toMatch(/shortcut icon|vite\.svg|react\.svg/)
    for (const m of index.matchAll(/rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)) expect(m[1]).toMatch(/\?v=\d+$/)
  })
})
