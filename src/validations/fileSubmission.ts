import { z } from 'zod'
import { FILE_CATEGORIES } from '@/types'
import { normalizeMobile } from './student'

export const CONTACT_PERSON_MAX = 80
export const DESCRIPTION_MIN = 20
export const DESCRIPTION_MAX = 1000
export const INSTRUCTIONS_MAX = 1000

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/

/**
 * Canonical contact details, exactly as the database stores them: a 10-digit Indian mobile number (spaces, hyphens,
 * brackets and a +91 / 91 / 0 prefix removed) or a lower-cased email. Returns null when it is neither.
 */
export function normalizeContact(raw: string): string | null {
  const v = raw.trim()
  const mobile = normalizeMobile(v.replace(/[()]/g, ''))
  if (/^[6-9]\d{9}$/.test(mobile)) return mobile
  if (v.length <= 120 && EMAIL.test(v)) return v.toLowerCase()
  return null
}

/**
 * The text fields of "Submit School Data File". Used by the form AND by both repositories (the form is never the only
 * gatekeeper; the database checks the same rules again). The file itself is checked by validateUploadFile/sniffSpreadsheet.
 */
export const schoolFileFieldsSchema = z.object({
  schoolId: z.string().trim().min(1, 'Please choose your school.'),
  contactPerson: z
    .string()
    .trim()
    .min(2, 'Please enter the name of the person submitting the file.')
    .max(CONTACT_PERSON_MAX, `The name must be ${CONTACT_PERSON_MAX} characters or fewer.`)
    .refine((v) => !/[<>]/.test(v), 'The name cannot contain < or >.'),
  contactDetails: z
    .string()
    .trim()
    .min(1, 'Please enter an email address or a mobile number.')
    .refine((v) => normalizeContact(v) !== null, 'Enter a valid email address or a 10-digit mobile number.'),
  category: z.enum(FILE_CATEGORIES, { error: 'Please choose what the file is for.' }),
  description: z
    .string()
    .trim()
    .min(DESCRIPTION_MIN, `Please describe the file in at least ${DESCRIPTION_MIN} characters.`)
    .max(DESCRIPTION_MAX, `The description must be ${DESCRIPTION_MAX} characters or fewer.`),
  instructions: z.string().trim().max(INSTRUCTIONS_MAX, `Additional instructions must be ${INSTRUCTIONS_MAX} characters or fewer.`),
})

export type SchoolFileFormValues = z.input<typeof schoolFileFieldsSchema>
