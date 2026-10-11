import type { z } from 'zod'
import { RepositoryError } from './errors'

/**
 * Parses repository input with a zod schema. On failure throws RepositoryError('invalid_input') carrying the first message
 * per field, so a form can show each one inline. Shared by the mock and Supabase repositories.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown, fallback: string): z.output<S> {
  const parsed = schema.safeParse(input)
  if (parsed.success) return parsed.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
  throw new RepositoryError('invalid_input', Object.values(fieldErrors)[0] ?? fallback, undefined, fieldErrors)
}
