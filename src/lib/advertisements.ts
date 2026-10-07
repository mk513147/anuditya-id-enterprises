import { formatDate } from '@/lib/format'
import type { Advertisement } from '@/types'

/**
 * The single rule for what the public may see. It is used by the repository (so hidden ads never leave
 * the data layer) and is exported so the UI and tests share exactly the same definition.
 *
 * An advertisement is public only when it is enabled (`active`), published (not a draft), has started
 * (`startsAt` is in the past or absent) and has not ended (`endsAt` is in the future or absent).
 * The end/start instants are inclusive.
 */
export function isAdvertisementVisible(ad: Advertisement, now: Date = new Date()): boolean {
  if (!ad.active || !ad.isPublished) return false
  const t = now.getTime()
  if (ad.startsAt && t < new Date(ad.startsAt).getTime()) return false
  if (ad.endsAt && t > new Date(ad.endsAt).getTime()) return false
  return true
}

/** "Valid until 31 Dec 2026", or null for an ongoing advertisement. */
export function advertisementValidityLabel(ad: Advertisement): string | null {
  return ad.endsAt ? `Valid until ${formatDate(ad.endsAt)}` : null
}
