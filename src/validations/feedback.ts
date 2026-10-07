import { z } from 'zod'

export const FEEDBACK_MESSAGE_MAX = 600

/**
 * Public feedback form. Only what is needed: a name, an optional school/organisation, a rating and a
 * message. No phone number or e-mail is collected.
 */
export const feedbackSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name (at least 2 characters).').max(60, 'Name must be 60 characters or fewer.'),
  organization: z.string().trim().max(100, 'School or organisation must be 100 characters or fewer.'),
  rating: z
    .number({ error: 'Please choose a rating from 1 to 5.' })
    .int('Please choose a rating from 1 to 5.')
    .min(1, 'Please choose a rating from 1 to 5.')
    .max(5, 'Please choose a rating from 1 to 5.'),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters.')
    .max(FEEDBACK_MESSAGE_MAX, `Please keep your feedback to ${FEEDBACK_MESSAGE_MAX} characters or fewer.`),
})

export type FeedbackFormValues = z.infer<typeof feedbackSchema>
