import { z } from 'zod'
import { SLUG_MAX, SLUG_MIN, SLUG_PATTERN } from '@/lib/slug'
import { normalizeMobile } from './student'

/** Field rules for the admin school form. Uniqueness (code, slug) is enforced by the repository. */
export const schoolSchema = z.object({
  name: z.string().trim().min(3, 'School name must be at least 3 characters.').max(100, 'School name must be 100 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .min(SLUG_MIN, `Link name must be at least ${SLUG_MIN} characters.`)
    .max(SLUG_MAX, `Link name must be ${SLUG_MAX} characters or fewer.`)
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens only, for example st-marys-school.'),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,12}$/, 'School code must be 2 to 12 letters, numbers or hyphens, for example STM-001.'),
  contactPerson: z.string().trim().min(2, 'Contact person is required.').max(80, 'Contact person must be 80 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required.')
    .refine((v) => /^[6-9]\d{9}$/.test(normalizeMobile(v)), 'Please enter a valid 10-digit mobile number.'),
  email: z
    .string()
    .trim()
    .max(120, 'Email must be 120 characters or fewer.')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Please enter a valid email address.'),
  address: z.string().trim().max(250, 'Address must be 250 characters or fewer.'),
})

export type SchoolFormValues = z.infer<typeof schoolSchema>
