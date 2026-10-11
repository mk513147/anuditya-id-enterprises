import { z } from 'zod'

/** Administrator sign-in. Only shape is checked here: whether the credentials are right is decided by Supabase Auth. */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Please enter your email address.').max(254, 'That email address is too long.').pipe(z.email('Please enter a valid email address.')),
  password: z.string().min(1, 'Please enter your password.').max(256, 'That password is too long.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
