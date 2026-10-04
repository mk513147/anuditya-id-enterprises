import { z } from 'zod'

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024 // prototype limit; adjust for production
export const PHOTO_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'
const PHOTO_TYPES = ['image/jpeg', 'image/png']
const PHOTO_EXT = /\.(jpe?g|png)$/i

export const CLASS_OPTIONS = [
  'Nursery', 'LKG', 'UKG',
  ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  'Other',
] as const

/** Today as YYYY-MM-DD (local time). Used as the max for the date input. */
export const todayISO = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Returns an error message, or null when the file is acceptable. Shared by the schema and the upload UI. */
export function validatePhotoFile(file: File): string | null {
  const typeOk = PHOTO_TYPES.includes(file.type) && PHOTO_EXT.test(file.name)
  if (!typeOk) return 'Please upload a JPG, JPEG or PNG image.'
  if (file.size > PHOTO_MAX_BYTES) return `Photo must be smaller than ${PHOTO_MAX_BYTES / (1024 * 1024)} MB.`
  if (file.size === 0) return 'This file looks empty. Please choose another photo.'
  return null
}

/** Strips spaces/dashes and a leading +91 / 91 / 0, leaving the bare number for validation and submission. */
export function normalizeMobile(raw: string): string {
  const v = raw.replace(/[\s-]/g, '')
  if (/^\+91\d{10}$/.test(v)) return v.slice(3)
  if (/^91\d{10}$/.test(v)) return v.slice(2)
  if (/^0\d{10}$/.test(v)) return v.slice(1)
  return v
}

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(60, `${label} must be 60 characters or fewer.`)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, `${label} can contain only letters and spaces.`)

const idField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`)
    .regex(/^[A-Za-z0-9/-]+$/, `${label} can contain only letters, numbers, / and -.`)

export const studentSchema = z.object({
  name: nameField('Student name'),
  fatherName: nameField("Father's name"),
  motherName: nameField("Mother's name"),
  dob: z
    .string()
    .min(1, 'Date of birth is required.')
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), 'Please enter a valid date of birth.')
    .refine((v) => v <= todayISO(), 'Date of birth cannot be in the future.')
    .refine((v) => v >= '1980-01-01', 'Please check the date of birth.'),
  className: z
    .string()
    .min(1, 'Please select a class.')
    .refine((v) => (CLASS_OPTIONS as readonly string[]).includes(v), 'Please select a class from the list.'),
  section: z
    .string()
    .trim()
    .min(1, 'Section is required.')
    .max(5, 'Section must be 5 characters or fewer.')
    .regex(/^[A-Za-z0-9 ]+$/, 'Section can contain only letters and numbers.'),
  rollNo: idField('Roll number', 10),
  admissionNo: idField('Admission number', 20),
  address: z.string().trim().min(10, 'Please enter the full address (at least 10 characters).').max(250, 'Address must be 250 characters or fewer.'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Mobile number is required.')
    .refine((v) => /^[6-9]\d{9}$/.test(normalizeMobile(v)), 'Please enter a valid 10-digit mobile number.'),
  photo: z
    .custom<File>((v) => v instanceof File, { message: 'Please upload the student photo.' })
    .superRefine((file, ctx) => {
      const message = validatePhotoFile(file)
      if (message) ctx.addIssue({ code: 'custom', message })
    }),
})

export type StudentFormValues = z.infer<typeof studentSchema>
