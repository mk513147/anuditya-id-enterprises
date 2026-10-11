import type { FileCategory, SchoolFileSubmission } from '@/types'
import { normalizeContact, schoolFileFieldsSchema } from '@/validations/fileSubmission'
import { getExtension, sniffSpreadsheet, validateUploadFile } from '@/validations/upload'
import { RepositoryError } from './errors'
import { parseInput } from './validate'

export interface CleanSubmission {
  schoolId: string
  contactPerson: string
  contactDetails: string
  category: FileCategory
  description: string
  instructions: string | null
  ext: 'xlsx' | 'xls' | 'csv'
}

/**
 * Re-validates a school file submission in the data layer (both repositories), before anything is uploaded.
 * Rejects RepositoryError('invalid_input') with a message per field (`file` for the file itself).
 */
export async function checkSubmission(input: SchoolFileSubmission): Promise<CleanSubmission> {
  // Optional instructions may arrive as undefined (the form sends that for an empty box): treat it as empty.
  const v = parseInput(schoolFileFieldsSchema, { ...input, instructions: input.instructions ?? '' }, 'Please check the form.')
  const fileProblem = validateUploadFile(input.file) ?? (await sniffSpreadsheet(input.file))
  if (fileProblem) throw new RepositoryError('invalid_input', fileProblem, undefined, { file: fileProblem })
  return {
    schoolId: v.schoolId,
    contactPerson: v.contactPerson,
    contactDetails: normalizeContact(v.contactDetails) as string,
    category: v.category,
    description: v.description,
    instructions: v.instructions || null,
    ext: getExtension(input.file.name) as CleanSubmission['ext'],
  }
}
