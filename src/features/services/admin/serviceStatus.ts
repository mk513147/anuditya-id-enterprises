import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import { isRepositoryError } from '@/services/errors'
import type { Service } from '@/types'

export const categoryLabel = (id: string) => SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id

/** One plain sentence on whether the public can see (and enquire about) this service. */
export const publicStatusNote = (s: Pick<Service, 'enabled'>) =>
  s.enabled
    ? 'Enabled: visitors can see this on the Home page and the Services page, and choose it when asking for a quote.'
    : 'Disabled: hidden from the Home page, the Services page and the quote form. Nothing is deleted.'

export interface ToggleCopy {
  title: string
  confirm: string
  /** Past tense for the success message. */
  done: string
  destructive: boolean
  body: string
}

/** Wording for the confirmation of enabling / disabling. Disabling is marked destructive because it hides the service. */
export function toggleCopy(s: Pick<Service, 'title' | 'enabled'>): ToggleCopy {
  return s.enabled
    ? { title: `Disable “${s.title}”?`, confirm: 'Disable', done: 'disabled', destructive: true, body: 'It is hidden from the Home page, the Services page and the quote form straight away. Nothing is deleted; you can enable it again later.' }
    : { title: `Enable “${s.title}”?`, confirm: 'Enable', done: 'enabled', destructive: false, body: 'It becomes visible on the Home page and the Services page, and can be chosen in the quote form, straight away.' }
}

export function serviceActionErrorMessage(e: unknown): string {
  if (isRepositoryError(e, 'not_found')) return 'This service no longer exists.'
  if (isRepositoryError(e, 'no_change')) return 'Nothing changed: it was already in that state. The list has been refreshed.'
  if (isRepositoryError(e, 'invalid_id') || isRepositoryError(e, 'invalid_input')) return 'This action could not be applied. Nothing was changed.'
  return 'Could not save the change. Nothing was changed. Please try again.'
}
