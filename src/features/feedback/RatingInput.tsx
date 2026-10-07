import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  value: number | undefined
  onChange: (value: number) => void
  onBlur?: () => void
  error?: string
}

/**
 * Five-star rating built from native radio buttons, so keyboard (Tab, arrow keys), screen readers and
 * form semantics work without extra code. The selected value is also written out as text.
 */
export function RatingInput({ id, value, onChange, onBlur, error }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} aria-invalid={!!error} className="space-y-1.5">
      <legend className="mb-1.5 text-[15px] font-medium leading-snug">
        Your rating
        <span aria-hidden className="text-destructive"> *</span>
        <span className="sr-only"> (required)</span>
      </legend>
      <div className="-ml-1.5 flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer rounded-lg p-1.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
          >
            <input
              type="radio"
              name={id}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              onBlur={onBlur}
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              className="sr-only"
            />
            <Star aria-hidden className={cn('size-9 transition-colors', n <= shown ? 'fill-gold-500 text-gold-500' : 'text-border')} />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-ink" aria-live="polite">
        {value ? `${value} out of 5` : 'Tap a star to rate'}
      </p>
      <p id={`${id}-error`} aria-live="polite" className="min-h-5 text-sm font-medium text-destructive">
        {error}
      </p>
    </fieldset>
  )
}
