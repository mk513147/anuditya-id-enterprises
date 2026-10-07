import { MailCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

/** Shown after a successful submission. Honest about what happened: received, awaiting review. */
export function FeedbackThanks({ onAnother }: { onAnother: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <div role="status" className="py-4 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-royal-600 text-white ring-8 ring-royal-100">
        <MailCheck className="size-8" aria-hidden />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-5 text-balance text-2xl font-extrabold outline-none">
        Thank you for your feedback
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-ink">
        We have received it. Feedback is reviewed before it appears on this site, so it may take a little while to show up.
      </p>
      <Button size="lg" variant="outline" className="mt-6" onClick={onAnother}>
        Send more feedback
      </Button>
      <p className="mx-auto mt-6 max-w-md rounded-xl bg-gold-100 px-4 py-3 text-xs leading-relaxed text-navy-900">
        <strong>Prototype notice:</strong> this submission is kept in temporary demo memory only. It is not stored permanently and will be cleared when the page is refreshed.
      </p>
    </div>
  )
}
