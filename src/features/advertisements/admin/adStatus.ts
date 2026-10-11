import { formatIstDay } from '@/lib/advertisements'
import { isRepositoryError } from '@/services/errors'
import type { AdminAdvertisement } from '@/services/types'

/** One plain sentence on whether the public can see this advertisement, and why not. */
export function publicStatusNote(ad: Pick<AdminAdvertisement, 'visibility' | 'isPublished' | 'active' | 'startsAt' | 'endsAt'>): string {
  switch (ad.visibility) {
    case 'live':
      return 'Live now: visitors can see this on the Home page and on the Advertisements page.'
    case 'scheduled':
      return `Not visible yet: it starts on ${ad.startsAt ? formatIstDay(ad.startsAt) : 'its start date'}.`
    case 'ended':
      return `Not visible: it ended on ${ad.endsAt ? formatIstDay(ad.endsAt) : 'its end date'}.`
    default: {
      const reasons = [!ad.isPublished && 'it is a draft (not published)', !ad.active && 'it is disabled'].filter(Boolean)
      return `Not visible: ${reasons.join(' and ')}.`
    }
  }
}

export interface ToggleCopy {
  title: string
  confirm: string
  /** Past tense for the success message, e.g. "unpublished". */
  done: string
  destructive: boolean
  body: string
}

/** Wording for the confirmation of each publish / enable action. Hiding actions are marked destructive. */
export function toggleCopy(ad: Pick<AdminAdvertisement, 'title' | 'isPublished' | 'active'>, action: 'publish' | 'enable'): ToggleCopy {
  if (action === 'publish') {
    return ad.isPublished
      ? { title: `Unpublish “${ad.title}”?`, confirm: 'Unpublish', done: 'unpublished', destructive: true, body: 'It goes back to a draft and is hidden from the public straight away. Nothing is deleted; you can publish it again later.' }
      : { title: `Publish “${ad.title}”?`, confirm: 'Publish', done: 'published', destructive: false, body: 'It becomes public as soon as it is also enabled and inside its dates (if any).' }
  }
  return ad.active
    ? { title: `Disable “${ad.title}”?`, confirm: 'Disable', done: 'disabled', destructive: true, body: 'It is hidden from the public straight away, whatever its dates. Nothing is deleted; you can enable it again later.' }
    : { title: `Enable “${ad.title}”?`, confirm: 'Enable', done: 'enabled', destructive: false, body: 'It becomes public as soon as it is also published and inside its dates (if any).' }
}

export const VISIBILITY_LABEL = { live: 'Live now', scheduled: 'Scheduled', ended: 'Ended', hidden: 'Hidden (draft or disabled)' } as const

export function adActionErrorMessage(e: unknown): string {
  if (isRepositoryError(e, 'not_found')) return 'This advertisement no longer exists.'
  if (isRepositoryError(e, 'no_change')) return 'Nothing changed: it was already in that state. The list has been refreshed.'
  if (isRepositoryError(e, 'invalid_id') || isRepositoryError(e, 'invalid_input')) return 'This action could not be applied. Nothing was changed.'
  return 'Could not save the change. Nothing was changed. Please try again.'
}
