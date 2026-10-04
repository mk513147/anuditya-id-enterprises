import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({ value, className }: { value: number; className?: string }) {
  return (
    <div role="img" aria-label={`Rated ${value} out of 5`} className={cn('flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cn('size-4', n <= value ? 'fill-gold-500 text-gold-500' : 'text-border')} />
      ))}
    </div>
  )
}
