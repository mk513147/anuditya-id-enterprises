import { z } from 'zod'

export const quoteSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  organization: z.string().trim().optional(),
  service: z.string().min(1, 'Please choose a service'),
  details: z.string().trim().max(500, 'Please keep this under 500 characters').optional(),
})

export type QuoteFormValues = z.infer<typeof quoteSchema>
