/** Rules for the job / order number a visitor types on the public Job Status page. */

export const ORDER_REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9-]{4,29}$/

/**
 * Canonical form: trimmed, upper-case, runs of whitespace become a single hyphen
 * ("job 2026 0003" -> "JOB-2026-0003"). Nothing else is guessed or repaired, and lookups are exact
 * matches on the result, so a partial or malformed reference can never return another order.
 */
export function normalizeOrderReference(raw: string): string {
  return raw.trim().replace(/\s+/g, '-').replace(/^-+|-+$/g, '').toUpperCase()
}

export const isValidOrderReference = (raw: string) => ORDER_REFERENCE_PATTERN.test(normalizeOrderReference(raw))
