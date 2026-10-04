import { Download, ListChecks } from 'lucide-react'
import { CallButton } from '@/components/shared/CallButton'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { BUSINESS } from '@/lib/business'
import { waMessages } from '@/lib/whatsapp'

const STEPS = [
  'Use Excel or CSV format.',
  'Make sure the student information is accurate.',
  'Keep column headings clear.',
  'Remove unnecessary rows and columns.',
  'Contact us if you need help preparing the file.',
]

interface Props {
  /**
   * Reserved for the "Download Sample Excel Format" link. Not passed yet because the required
   * columns have not been confirmed by the customer. Supplying a URL here shows the link.
   */
  sampleFormatHref?: string
}

export function UploadHelp({ sampleFormatHref }: Props) {
  return (
    <aside aria-labelledby="upload-help-title" className="rounded-[var(--radius-card)] border bg-white p-5 shadow-card lg:sticky lg:top-24">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gold-100 text-gold-700">
          <ListChecks className="size-5" aria-hidden />
        </span>
        <h2 id="upload-help-title" className="text-lg font-bold">Before uploading</h2>
      </div>
      <ol className="mt-4 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex gap-3 text-sm leading-relaxed text-ink">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-royal-100 text-xs font-bold text-royal-700">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {sampleFormatHref && (
        <Button asChild variant="outline" className="mt-5 w-full">
          <a href={sampleFormatHref} download>
            <Download aria-hidden /> Download Sample Excel Format
          </a>
        </Button>
      )}

      <div className="mt-5 space-y-2 border-t pt-5">
        <p className="text-sm font-semibold text-navy-900">Need help? WhatsApp us.</p>
        <WhatsAppButton className="w-full" label="WhatsApp Us" message={waMessages.fileUploadHelp()} />
        <CallButton className="w-full" label={`Call ${BUSINESS.phone}`} />
      </div>
    </aside>
  )
}
