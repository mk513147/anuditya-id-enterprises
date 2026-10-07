import { z } from 'zod'
import { isValidOrderReference } from '@/lib/orderReference'

export const trackOrderSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'Please enter your job or order number.')
    .refine(isValidOrderReference, 'Enter a valid reference such as JOB-2026-0003. Use only letters, numbers and hyphens.'),
})

export type TrackOrderValues = z.infer<typeof trackOrderSchema>
