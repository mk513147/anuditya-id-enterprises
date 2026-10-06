export const SLUG_MIN = 3
export const SLUG_MAX = 60
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Turns a school name into a URL-safe slug: lowercase ASCII letters, digits and single hyphens.
 * "St. Mary's School" -> "st-marys-school". Falls back to "school" when nothing usable remains
 * (e.g. a name written only in Devanagari), so callers must still enforce uniqueness.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/['’`]/g, '') // St. Mary's -> Marys, not Mary-s
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return slug || 'school'
}

/** Returns `base`, or `base-2`, `base-3`… the first one not present in `taken` (case-insensitive). */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((s) => s.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`
    if (!used.has(candidate)) return candidate
  }
}
