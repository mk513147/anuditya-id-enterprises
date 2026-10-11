import type { UseFormSetError } from 'react-hook-form'
import { istDay } from '@/lib/advertisements'
import { isRepositoryError } from '@/services/errors'
import type { Advertisement } from '@/types'
import type { AdvertisementFormValues } from '@/validations/advertisement'

/** The repository names the schedule fields startsAt / endsAt; the form calls them startDate / endDate. */
const FORM_FIELD: Record<string, keyof AdvertisementFormValues> = { startsAt: 'startDate', endsAt: 'endDate' }

export function formDefaults(ad?: Advertisement): AdvertisementFormValues {
  return {
    title: ad?.title ?? '',
    description: ad?.description ?? '',
    offer: ad?.offer ?? '',
    image: ad?.image ?? '',
    icon: ad?.icon ?? 'id-card',
    whatsappMessage: ad?.whatsappMessage ?? '',
    active: ad?.active ?? true,
    // A new advertisement starts as a draft: nothing becomes public until an admin chooses to publish it.
    isPublished: ad?.isPublished ?? false,
    featured: ad?.featured ?? false,
    startDate: ad?.startsAt ? istDay(ad.startsAt) : '',
    endDate: ad?.endsAt ? istDay(ad.endsAt) : '',
  }
}

/** Shows repository validation messages next to the right fields. Returns true if it handled the error. */
export function applyFieldErrors(e: unknown, setError: UseFormSetError<AdvertisementFormValues>): boolean {
  if (!isRepositoryError(e, 'invalid_input') || !e.fieldErrors) return false
  Object.entries(e.fieldErrors).forEach(([field, message], i) => {
    setError((FORM_FIELD[field] ?? field) as keyof AdvertisementFormValues, { message }, { shouldFocus: i === 0 })
  })
  return true
}

