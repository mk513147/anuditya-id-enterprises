import { describe, expect, it } from 'vitest'
import { SLUG_MAX, SLUG_PATTERN, nextFreeSlug, slugify } from './slug'

describe('slugify', () => {
  it.each([
    ["St. Mary's School", 'st-marys-school'],
    ['Green Valley College', 'green-valley-college'],
    ['  Model   Academy  ', 'model-academy'],
    ['Smith & Sons Academy', 'smith-and-sons-academy'],
    ['École Française', 'ecole-francaise'],
    ['School #5 (Main)', 'school-5-main'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('falls back to "school" when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('school')
    expect(slugify('दिल्ली पब्लिक स्कूल')).toBe('school')
  })

  it('never exceeds the max length and never ends with a hyphen', () => {
    const slug = slugify('a'.repeat(SLUG_MAX - 1) + ' b long tail')
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('always produces a valid slug', () => {
    for (const name of ["St. Mary's", 'A  B', '---x---', 'Ünï-cödé 99']) expect(slugify(name)).toMatch(SLUG_PATTERN)
  })
})

describe('nextFreeSlug', () => {
  it('returns the base when free', () => {
    expect(nextFreeSlug('lotus', ['other'])).toBe('lotus')
  })
  it('appends -2, -3… for duplicates, case-insensitively', () => {
    expect(nextFreeSlug('lotus', ['LOTUS'])).toBe('lotus-2')
    expect(nextFreeSlug('lotus', ['lotus', 'lotus-2'])).toBe('lotus-3')
  })
  it('keeps the suffixed result within the max length', () => {
    const base = 'x'.repeat(SLUG_MAX)
    const result = nextFreeSlug(base, [base])
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(result.endsWith('-2')).toBe(true)
  })
})
