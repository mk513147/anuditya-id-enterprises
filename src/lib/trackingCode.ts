/**
 * Order tracking codes. The database generates them (25 characters from an alphabet without look-alikes such as
 * 0/O and 1/I, shown in five groups of five) and stores only a hash. A code is a secret: it is shown once to the
 * administrator, typed by the customer, and never put in a URL, a log or browser storage.
 */
export const TRACKING_CODE_LENGTH = 25

/** Canonical form, as the database compares it: letters and digits only, upper-case (spaces and hyphens are ignored). */
export function normalizeTrackingCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export const isWellFormedTrackingCode = (raw: string) => /^[A-Z2-9]{25}$/.test(normalizeTrackingCode(raw))

/** Display form: ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2. */
export function formatTrackingCode(raw: string): string {
  return (normalizeTrackingCode(raw).match(/.{1,5}/g) ?? []).join('-')
}
