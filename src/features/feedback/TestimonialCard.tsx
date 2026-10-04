import { Quote } from 'lucide-react'
import { StarRating } from '@/components/shared/StarRating'
import type { Feedback } from '@/types'

export function TestimonialCard({ feedback }: { feedback: Feedback }) {
  const initials = feedback.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
  return (
    <figure className="flex h-full flex-col rounded-[var(--radius-card)] border bg-white p-5 shadow-card sm:p-6">
      <Quote className="size-7 text-gold-500" aria-hidden />
      <StarRating value={feedback.rating} className="mt-3" />
      <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">“{feedback.message}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t pt-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-royal-100 font-display text-sm font-bold text-royal-700">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-navy-900">{feedback.name}</span>
          <span className="block truncate text-xs text-muted-ink">{feedback.organization}</span>
        </span>
      </figcaption>
    </figure>
  )
}
