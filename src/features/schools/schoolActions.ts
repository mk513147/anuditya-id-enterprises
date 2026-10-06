import { toast } from 'sonner'
import { copyText } from '@/lib/clipboard'
import { schoolLink } from '@/lib/schoolLinks'

/** Copies a school's public submission link and reports the outcome. */
export async function copySchoolLink(slug: string) {
  const link = schoolLink(slug)
  if (await copyText(link)) {
    toast.success('School link copied', { description: link })
  } else {
    toast.error('Could not copy automatically', { description: `Please copy it manually: ${link}` })
  }
}
