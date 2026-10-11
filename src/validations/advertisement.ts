import { z } from 'zod'
import { istDayEnd, istDayStart } from '@/lib/advertisements'

/** Icons an admin can choose for the branded placeholder (used when there is no image). All exist in lib/icons. */
export const ADVERTISEMENT_ICONS = [
  { value: 'id-card', label: 'ID card' },
  { value: 'ribbon', label: 'Lanyard / ribbon' },
  { value: 'diary', label: 'Diary' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'prospectus', label: 'Prospectus' },
  { value: 'banner', label: 'Banner' },
  { value: 'pen-tool', label: 'Design' },
  { value: 'printer', label: 'Printing' },
  { value: 'school', label: 'School' },
  { value: 'graduation', label: 'College' },
  { value: 'camera', label: 'Photo' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'truck', label: 'Delivery' },
] as const

export const ICON_VALUES = ADVERTISEMENT_ICONS.map((i) => i.value) as string[]

export const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
export const isRealDay = (v: string) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)

/**
 * Text and flag rules, shared by the admin form AND the repository, so the form is never the only gatekeeper.
 * `offer` and `image` may be empty strings (the repository stores them as "not set").
 */
export const advertisementFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(80, 'Title must be 80 characters or fewer.'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(300, 'Description must be 300 characters or fewer.'),
  offer: z.string().trim().max(60, 'Offer label must be 60 characters or fewer.'),
  image: z
    .string()
    .trim()
    .max(500, 'Image link must be 500 characters or fewer.')
    .refine((v) => v === '' || isHttpUrl(v), 'Enter a full web address starting with http:// or https://.'),
  icon: z.string().refine((v) => ICON_VALUES.includes(v), 'Choose one of the listed icons.'),
  whatsappMessage: z.string().trim().min(2, 'Enquiry topic must be at least 2 characters.').max(120, 'Enquiry topic must be 120 characters or fewer.'),
  active: z.boolean({ error: 'Enabled must be true or false.' }),
  isPublished: z.boolean({ error: 'Published must be true or false.' }),
  featured: z.boolean({ error: 'Featured must be true or false.' }),
}

/** End must not be before start. Returns a message or null. Works for instants and for plain days. */
export const scheduleError = (start?: string, end?: string) => (start && end && Date.parse(end) < Date.parse(start) ? 'The end date must not be before the start date.' : null)

/** What the repository validates: the editable fields with the schedule as ISO instants. */
export const advertisementInputSchema = z
  .object({
    ...advertisementFields,
    offer: advertisementFields.offer.optional(),
    image: advertisementFields.image.optional(),
    startsAt: z.iso.datetime({ offset: true, error: 'Start must be a valid date and time.' }).optional(),
    endsAt: z.iso.datetime({ offset: true, error: 'End must be a valid date and time.' }).optional(),
  })
  .superRefine((v, ctx) => {
    const msg = scheduleError(v.startsAt, v.endsAt)
    if (msg) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: msg })
  })

/** The admin form: the schedule is picked as calendar days (India), empty = no limit. */
const dayField = (label: string) => z.string().refine((v) => v === '' || isRealDay(v), `${label} must be a real date.`)

export const advertisementFormSchema = z
  .object({ ...advertisementFields, startDate: dayField('Start date'), endDate: dayField('End date') })
  .superRefine((v, ctx) => {
    const msg = scheduleError(v.startDate || undefined, v.endDate || undefined)
    if (msg) ctx.addIssue({ code: 'custom', path: ['endDate'], message: msg })
  })

export type AdvertisementFormValues = z.infer<typeof advertisementFormSchema>

/** Form values → what the repository takes. Empty optional fields become "not set"; days become IST boundaries. */
export const toAdvertisementInput = (v: AdvertisementFormValues) => ({
  title: v.title.trim(),
  description: v.description.trim(),
  offer: v.offer.trim() || undefined,
  image: v.image.trim() || undefined,
  icon: v.icon,
  whatsappMessage: v.whatsappMessage.trim(),
  active: v.active,
  isPublished: v.isPublished,
  featured: v.featured,
  startsAt: v.startDate ? istDayStart(v.startDate) : undefined,
  endsAt: v.endDate ? istDayEnd(v.endDate) : undefined,
})
