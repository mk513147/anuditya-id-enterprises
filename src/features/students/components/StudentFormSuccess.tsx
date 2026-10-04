import { motion, useReducedMotion } from 'motion/react'
import { Check, CheckCircle2, Copy, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'
import { waMessages } from '@/lib/whatsapp'

export function StudentFormSuccess({ referenceNo, onReset }: { referenceNo: string; onReset: () => void }) {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the confirmation so screen-reader and keyboard users land on it.
  useEffect(() => {
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  const copy = async () => {
    if (await copyText(referenceNo)) {
      setCopied(true)
      toast.success('Reference number copied')
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Could not copy. Please note the number down.')
    }
  }

  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="overflow-hidden rounded-[var(--radius-card)] border bg-white text-center shadow-card"
    >
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-5 py-8 text-white sm:py-10">
        <motion.span
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-white/20 ring-4 ring-white/25"
        >
          <CheckCircle2 className="size-9" aria-hidden />
        </motion.span>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-balance text-2xl font-extrabold text-white outline-none sm:text-3xl">
          Your form has been submitted successfully.
        </h2>
      </div>

      <div className="space-y-5 p-5 sm:p-8">
        <div>
          <p className="text-sm font-medium text-muted-ink">Your Reference No. is:</p>
          <p className="mx-auto mt-2 w-fit max-w-full rounded-2xl border-2 border-dashed border-royal-500/40 bg-royal-50 px-5 py-3 font-display text-2xl font-extrabold tracking-wide text-navy-900 sm:text-3xl">
            <span className="break-all">{referenceNo}</span>
          </p>
          <p className="mt-2 text-sm text-muted-ink">Keep this number. You can use it to check your job status.</p>
        </div>

        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Button size="lg" onClick={copy} variant={copied ? 'secondary' : 'default'}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Copied' : 'Copy Reference Number'}
          </Button>
          <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.studentForm(referenceNo)} />
          <Button size="lg" variant="outline" onClick={onReset}>
            <RotateCcw aria-hidden /> Submit Another Form
          </Button>
        </div>

        <p className="mx-auto max-w-md rounded-xl bg-gold-100 px-4 py-3 text-xs leading-relaxed text-navy-900">
          <strong>Prototype notice:</strong> this submission is kept in temporary demo memory only. It is not stored permanently and will be cleared when the page is refreshed.
        </p>
      </div>
    </motion.div>
  )
}
