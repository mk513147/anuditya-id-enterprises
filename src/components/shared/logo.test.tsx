/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LOGO_ASSETS, LOGO_NAME } from '@/lib/logo'
import { Logo } from './Logo'

const ROOT = path.resolve(import.meta.dirname, '../../..')
/** Static markup with attribute entities decoded (Vite inlines the small symbol as a data: URL containing quotes). */
const render = (ui: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>).replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('Logo component', () => {
  it('renders the official asset for each variant with its intrinsic size (no layout shift, aspect ratio kept)', () => {
    for (const [variant, a] of Object.entries(LOGO_ASSETS)) {
      const html = render(<Logo variant={variant as keyof typeof LOGO_ASSETS} to={null} />)
      expect(html, variant).toContain(`src="${a.src}"`)
      expect(html, variant).toContain(`width="${a.width}" height="${a.height}"`)
      expect(html, variant).toContain('w-auto')
    }
  })

  it('the responsive variant serves the full logo from xl up and the compact one below', () => {
    const html = render(<Logo variant="responsive" />)
    expect(html).toMatch(new RegExp(`<source media="\\(min-width: 1280px\\)" srcSet="${LOGO_ASSETS.full.src}" width="1600" height="368"/>`))
    expect(html).toContain(`src="${LOGO_ASSETS.compact.src}"`)
  })

  it('as a link, the name is announced once (on the link), and the image is decorative', () => {
    const html = render(<Logo />)
    expect(html).toContain(`aria-label="${LOGO_NAME} – home"`)
    expect(html).toContain('href="/"')
    expect(html).toContain('alt=""')
  })

  it('without a link, the image carries the name (or a caller-supplied alternative)', () => {
    expect(render(<Logo to={null} />)).toContain(`alt="${LOGO_NAME}"`)
    expect(render(<Logo to={null} alt="" />)).toContain('alt=""') // purely decorative use
    expect(render(<Logo to={null} />)).not.toContain('<a ')
  })

  it('puts the logo on a white plate for dark surfaces instead of recolouring it', () => {
    const html = render(<Logo plate />)
    expect(html).toContain('bg-white')
    expect(html).not.toMatch(/filter|invert|brightness|grayscale|hue-rotate/)
  })

  it('the old placeholder mark is gone', () => {
    const src = read('src/components/shared/Logo.tsx')
    expect(src).not.toMatch(/IdCard|lucide-react/)
  })
})

describe('logo assets', () => {
  const files = [
    'src/assets/branding/anuditya-id-solutions-logo.svg',
    'src/assets/branding/anuditya-id-solutions-compact.svg',
    'src/assets/branding/anuditya-symbol.svg',
    'public/favicon.svg',
  ]

  it.each(files)('%s is pure vector: paths only, no raster, font, script, style or external reference', (rel) => {
    const svg = read(rel)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-\d. ]+"/)
    const tags = [...new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]))].sort()
    expect(tags).toEqual(['path', 'svg', 'title'])
    expect(svg).not.toMatch(/<image|<script|<style|<text|<foreignObject|href=|base64|data:|url\(|font-family|filter|gradient/i)
  })

  it.each(files)('%s uses only the two official colours', (rel) => {
    const fills = [...new Set([...read(rel).matchAll(/fill="([^"]+)"/g)].map((m) => m[1]))].sort()
    expect(fills.every((f) => ['#363435', '#EC3237'].includes(f)), fills.join(',')).toBe(true)
  })

  it('the master keeps the full composition (red and charcoal artwork), the symbol is red only, and the favicon is the symbol', () => {
    expect(read(files[0])).toContain('fill="#363435"')
    expect(read(files[0])).toContain('fill="#EC3237"')
    expect(read(files[0])).toContain('<title>Anuditya ID Solutions – Complete solution in one roof</title>')
    expect(read(files[2])).not.toContain('#363435')
    expect(read('public/favicon.svg')).toBe(read(files[2]))
  })

  it('declared intrinsic sizes match each file’s viewBox', () => {
    const vb = (rel: string) => read(rel).match(/viewBox="([^"]+)"/)![1].split(' ').map(Number)
    expect(vb(files[0]).slice(2)).toEqual([LOGO_ASSETS.full.width, LOGO_ASSETS.full.height])
    expect(vb(files[1]).slice(2)).toEqual([LOGO_ASSETS.compact.width, LOGO_ASSETS.compact.height])
    expect(vb(files[2]).slice(2)).toEqual([LOGO_ASSETS.symbol.width, LOGO_ASSETS.symbol.height])
  })

  it('every icon referenced by index.html and the web manifest exists, and nothing is fetched from elsewhere', () => {
    const html = read('index.html')
    const refs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    expect(refs).toEqual(['/favicon.ico?v=2', '/favicon.svg?v=2', '/apple-touch-icon.png?v=2', '/site.webmanifest?v=2'])
    const manifest = JSON.parse(read('public/site.webmanifest')) as { icons: { src: string }[] }
    for (const src of [...refs, ...manifest.icons.map((i) => i.src)]) {
      expect(src.startsWith('/'), src).toBe(true)
      expect(fs.existsSync(path.join(ROOT, 'public', src.split('?')[0])), src).toBe(true)
    }
  })
})
