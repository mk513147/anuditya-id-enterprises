import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { PageHero } from '@/components/shared/PageHero'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { FeedbackForm } from '@/features/feedback/FeedbackForm'
import { FeedbackThanks } from '@/features/feedback/FeedbackThanks'
import { useApprovedFeedback } from '@/features/feedback/hooks'
import { TestimonialList } from '@/features/feedback/TestimonialList'
import { usePageTitle } from '@/hooks/usePageTitle'

export function FeedbackPage() {
  usePageTitle('Share Your Feedback')
  const [sent, setSent] = useState(false)
  // Same hook and repository as the Home page, so both show the same approved testimonials.
  const { data, isPending, isError, refetch } = useApprovedFeedback()

  return (
    <>
      <PageHero
        breadcrumb="Feedback"
        eyebrow="Customer Feedback"
        title="Share Your Feedback"
        description="Tell us how we did. Your feedback helps us improve our ID card and printing services."
      />

      <section aria-label="Feedback form" className="container-page py-10 sm:py-14">
        <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
          <Reveal className="min-w-0">
            <div className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
              {sent ? <FeedbackThanks onAnother={() => setSent(false)} /> : <FeedbackForm onSubmitted={() => setSent(true)} />}
            </div>
          </Reveal>
          <aside aria-labelledby="fb-how" className="rounded-[var(--radius-card)] border bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-gold-100 text-gold-700">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <h2 id="fb-how" className="text-lg font-bold">How it works</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
              <li>Your feedback is reviewed before it is shown publicly.</li>
              <li>Only your name and organisation are shown with an approved testimonial.</li>
              <li>You do not need to give a phone number or e-mail.</li>
            </ul>
          </aside>
        </div>
      </section>

      <section aria-labelledby="fb-testimonials" className="bg-surface">
        <div className="container-page section-y">
          <SectionHeading id="fb-testimonials" eyebrow="Testimonials" title="What schools and colleges say" description="Sample feedback shown for this prototype." />
          <TestimonialList state={isError ? 'error' : isPending ? 'loading' : 'ready'} items={data} onRetry={() => void refetch()} />
        </div>
      </section>
    </>
  )
}
