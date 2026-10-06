/** Public path prefix for school-specific student submission pages. Must match the route in router.tsx. */
export const SCHOOL_LINK_PREFIX = '/school'

export const schoolPath = (slug: string) => `${SCHOOL_LINK_PREFIX}/${encodeURIComponent(slug)}`

/**
 * Absolute link for sharing, built from the *current* origin (never a hard-coded domain), so it is
 * correct on localhost, preview deployments and the production domain alike.
 *
 * The slug is an identifier, not a secret: anyone with the link can open it.
 */
export const schoolLink = (slug: string) => `${window.location.origin}${schoolPath(slug)}`
