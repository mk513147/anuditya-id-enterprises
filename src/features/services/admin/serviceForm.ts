import type { UseFormSetError } from 'react-hook-form'
import { isRepositoryError } from '@/services/errors'
import type { Service } from '@/types'
import type { ServiceFormValues } from '@/validations/service'

export function formDefaults(service?: Service): ServiceFormValues {
  return {
    title: service?.title ?? '',
    tagline: service?.tagline ?? '',
    category: service?.category ?? 'id-cards',
    description: service?.description ?? '',
    image: service?.image ?? '',
    icon: service?.icon ?? 'id-card',
    enabled: service?.enabled ?? true,
  }
}

/** Shows repository validation messages (including "name already used") next to the right fields. Returns true if handled. */
export function applyFieldErrors(e: unknown, setError: UseFormSetError<ServiceFormValues>): boolean {
  if (!(isRepositoryError(e, 'invalid_input') || isRepositoryError(e, 'duplicate_title')) || !e.fieldErrors) return false
  Object.entries(e.fieldErrors).forEach(([field, message], i) => {
    setError(field as keyof ServiceFormValues, { message }, { shouldFocus: i === 0 })
  })
  return true
}
