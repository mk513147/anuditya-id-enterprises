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

export type AdVisibility = 'live' | 'scheduled' | 'ended' | 'hidden'

/**
 * Where an advertisement stands right now, as one word. 'hidden' means an admin has switched it off or it is
 * still a draft (whatever its dates); otherwise the dates decide. 'live' is exactly isAdvertisementVisible.
 */
export function advertisementVisibility(ad: Advertisement, now: Date = new Date()): AdVisibility {
  if (!ad.active || !ad.isPublished) return 'hidden'
  const t = now.getTime()
  if (ad.startsAt && t < new Date(ad.startsAt).getTime()) return 'scheduled'
  if (ad.endsAt && t > new Date(ad.endsAt).getTime()) return 'ended'
  return 'live'
}

/**
 * Dates are chosen as calendar days in India. A start day begins at 00:00 IST and an end day lasts until
 * 23:59:59 IST (the same boundaries the seeded advertisements use), whatever the browser's time zone.
 */
const IST_OFFSET_MS = 330 * 60_000
export const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString()
export const istDayEnd = (day: string) => new Date(`${day}T23:59:59+05:30`).toISOString()
/** The India calendar day (YYYY-MM-DD) an instant falls on. */
export const istDay = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

/** "31 Dec 2026" for an instant, read as an India calendar day (not the browser's own time zone). */
export const formatIstDay = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(iso))
