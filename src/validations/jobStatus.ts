import { z } from 'zod'
import { isValidOrderReference } from '@/lib/orderReference'
import { isWellFormedTrackingCode } from '@/lib/trackingCode'

export const trackOrderSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'Please enter your job or order number.')
    .refine(isValidOrderReference, 'Enter a valid reference such as JOB-2026-0003. Use only letters, numbers and hyphens.'),
  trackingCode: z
    .string()
    .trim()
    .min(1, 'Please enter the tracking code from your order confirmation.')
    .refine((v) => v === '' || isWellFormedTrackingCode(v), 'The tracking code has 25 letters and numbers, for example ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2.'),
})

export type TrackOrderValues = z.infer<typeof trackOrderSchema>
