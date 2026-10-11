import { z } from 'zod'
import { isRealDay } from './advertisement'

/**
 * Rules for creating an order, shared by the admin form AND both repositories (the form is never the only gatekeeper;
 * the database re-checks with its own constraints). Dates are calendar days (YYYY-MM-DD).
 * `schoolId` empty = no school, and then `customer` is required.
 */
export const orderInputSchema = z
  .object({
    schoolId: z.string().trim(),
    customer: z.string().trim().max(100, 'Customer name must be 100 characters or fewer.'),
    service: z.string().trim().min(1, 'Choose or enter the service.').max(100, 'Service must be 100 characters or fewer.'),
    quantity: z.coerce
      .number({ error: 'Enter the quantity.' })
      .int('Quantity must be a whole number.')
      .min(1, 'Quantity must be at least 1.')
      .max(1_000_000, 'Quantity must be 1,000,000 or fewer.'),
    orderDate: z.string().refine(isRealDay, 'Enter a real order date.'),
    expectedDelivery: z.string().refine(isRealDay, 'Enter a real expected delivery date.'),
    notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer.'),
  })
  .superRefine((v, ctx) => {
    if (!v.schoolId && !v.customer) ctx.addIssue({ code: 'custom', path: ['customer'], message: 'Choose a school or enter the customer name.' })
    if (isRealDay(v.orderDate) && isRealDay(v.expectedDelivery) && v.expectedDelivery < v.orderDate) {
      ctx.addIssue({ code: 'custom', path: ['expectedDelivery'], message: 'Expected delivery cannot be before the order date.' })
    }
  })

export type OrderFormValues = z.input<typeof orderInputSchema>
