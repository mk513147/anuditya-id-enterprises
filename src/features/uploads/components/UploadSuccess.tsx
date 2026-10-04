import { motion, useReducedMotion } from 'motion/react'
import { Check, CheckCircle2, Copy, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'
import { formatBytes, formatDateTime } from '@/lib/format'
import { waMessages } from '@/lib/whatsapp'
import type { FileUploadResult } from '@/types'
import { FILE_TYPE_LABEL } from '@/validations/upload'

export function UploadSuccess({ result, onReset }: { result: FileUploadResult; onReset: () => void }) {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  const copy = async () => {
    if (await copyText(result.referenceNo)) {
      setCopied(true)
      toast.success('Reference ID copied')
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Could not copy. Please note the ID down.')
    }
  }

  const rows = [
    ['File name', result.originalName],
    ['File type', FILE_TYPE_LABEL[result.type]],
    ['File size', formatBytes(result.sizeBytes)],
    ['Uploaded', formatDateTime(result.uploadedAt)],
  ]

  return (
    <div role="status">
      <div className="text-center">
        <motion.span
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-royal-600 text-white ring-8 ring-royal-100"
        >
          <CheckCircle2 className="size-9" aria-hidden />
        </motion.span>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-balance text-2xl font-extrabold outline-none sm:text-3xl">
          File uploaded successfully.
        </h2>
        <p className="mt-2 text-sm text-muted-ink">Your Upload Reference ID is:</p>
        <p className="mx-auto mt-2 w-fit max-w-full rounded-2xl border-2 border-dashed border-royal-500/40 bg-royal-50 px-5 py-3 font-display text-2xl font-extrabold tracking-wide text-navy-900 sm:text-3xl">
          <span className="break-all" data-testid="upload-ref">{result.referenceNo}</span>
        </p>
      </div>

      <dl className="mt-6 divide-y rounded-2xl border bg-surface text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)] gap-0.5 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
            <dt className="font-medium text-muted-ink">{k}</dt>
            <dd className="break-words font-semibold text-navy-900 [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        <Button size="lg" variant={copied ? 'secondary' : 'default'} onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copied' : 'Copy Reference ID'}
        </Button>
        <Button size="lg" variant="outline" onClick={onReset}>
          <RotateCcw aria-hidden /> Upload Another File
        </Button>
        <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.fileUploaded(result.referenceNo)} />
      </div>

      <p className="mx-auto mt-5 max-w-md rounded-xl bg-gold-100 px-4 py-3 text-xs leading-relaxed text-navy-900">
        <strong>Prototype notice:</strong> this upload is simulated. The file is not stored permanently and the details above will be cleared when the page is refreshed.
      </p>
    </div>
  )
}
