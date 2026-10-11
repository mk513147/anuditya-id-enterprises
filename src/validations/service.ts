import { z } from 'zod'
import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import type { ServiceInput } from '@/types'
import { isHttpUrl } from './advertisement'

/** Icons an admin can choose for the branded placeholder and the icon chip. All exist in lib/icons. */
export const SERVICE_ICONS = [
  { value: 'id-card', label: 'ID card' },
  { value: 'users', label: 'Staff / people' },
  { value: 'school', label: 'School' },
  { value: 'graduation', label: 'College' },
  { value: 'ribbon', label: 'Lanyard / ribbon' },
  { value: 'diary', label: 'Diary' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'prospectus', label: 'Prospectus' },
  { value: 'camera', label: 'Photo' },
  { value: 'pen-tool', label: 'Design' },
  { value: 'banner', label: 'Banner' },
  { value: 'printer', label: 'Printing' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'truck', label: 'Delivery' },
] as const

const ICON_VALUES = SERVICE_ICONS.map((i) => i.value) as string[]
const CATEGORY_IDS = SERVICE_CATEGORIES.map((c) => c.id) as string[]

/**
 * Field rules shared by the admin form AND the repository, so the form is never the only gatekeeper.
 * `image` may be an empty string (stored as "not set").
 */
export const serviceFields = {
  title: z.string().trim().min(3, 'Service name must be at least 3 characters.').max(60, 'Service name must be 60 characters or fewer.'),
  tagline: z.string().trim().min(2, 'Short label must be at least 2 characters.').max(40, 'Short label must be 40 characters or fewer.'),
  category: z.string().refine((v) => CATEGORY_IDS.includes(v), 'Choose one of the listed categories.'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(250, 'Description must be 250 characters or fewer.'),
  image: z
    .string()
    .trim()
    .max(500, 'Image link must be 500 characters or fewer.')
    .refine((v) => v === '' || isHttpUrl(v), 'Enter a full web address starting with http:// or https://.'),
  icon: z.string().refine((v) => ICON_VALUES.includes(v), 'Choose one of the listed icons.'),
  enabled: z.boolean({ error: 'Enabled must be true or false.' }),
}

/** What the repository validates. */
export const serviceInputSchema = z.object({ ...serviceFields, image: serviceFields.image.optional() })

/** The admin form (same rules; the repository additionally checks that the name is unique). */
export const serviceFormSchema = z.object(serviceFields)
export type ServiceFormValues = z.infer<typeof serviceFormSchema>

/** Form values → what the repository takes. An empty image link becomes "not set". */
export const toServiceInput = (v: ServiceFormValues): ServiceInput => ({
  title: v.title.trim(),
  tagline: v.tagline.trim(),
  category: v.category as ServiceInput['category'],
  description: v.description.trim(),
  image: v.image.trim() || undefined,
  icon: v.icon,
  enabled: v.enabled,
})
