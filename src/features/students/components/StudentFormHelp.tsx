import { CheckCircle2, LifeBuoy } from 'lucide-react'
import { CallButton } from '@/components/shared/CallButton'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { BUSINESS } from '@/lib/business'
import { waMessages } from '@/lib/whatsapp'

const TIPS = [
  'Keep the student information accurate. It is printed on the ID card.',
  'Upload a clear student photograph.',
  'Use a valid mobile number.',
  `Contact ${BUSINESS.name} if you need assistance.`,
]

export function StudentFormHelp() {
  return (
    <aside aria-labelledby="sf-help-title" className="rounded-[var(--radius-card)] border bg-white p-5 shadow-card lg:sticky lg:top-24">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gold-100 text-gold-700">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <h2 id="sf-help-title" className="text-lg font-bold">Before you submit</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {TIPS.map((t) => (
          <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-ink">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2 border-t pt-5">
        <p className="text-sm font-semibold text-navy-900">Need help with the form?</p>
        <WhatsAppButton className="w-full" label="WhatsApp Us" message={waMessages.general()} />
        <CallButton className="w-full" label={`Call ${BUSINESS.phone}`} />
      </div>
    </aside>
  )
}
