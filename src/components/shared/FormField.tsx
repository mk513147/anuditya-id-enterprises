import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface ControlProps {
  id: string
  'aria-invalid': boolean
  'aria-required': boolean
  'aria-describedby': string | undefined
}

interface Props {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  /** Render the control with the ids/aria attributes it needs wired up. */
  children: (control: ControlProps) => ReactNode
}

/**
 * Label + control + hint + error, with accessible associations.
 * The error line reserves its height so validation does not make the form jump.
 */
export function FormField({ id, label, required, hint, error, children }: Props) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="space-y-1.5 pb-1.5">
      <Label htmlFor={id} className="text-[15px] leading-snug">
        {label}
        {required && (
          <>
            <span aria-hidden className="text-destructive"> *</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </Label>
      {children({
        id,
        'aria-invalid': !!error,
        'aria-required': !!required,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-ink">
          {hint}
        </p>
      )}
      <p id={errorId} aria-live="polite" className="min-h-5 text-sm font-medium text-destructive">
        {error}
      </p>
    </div>
  )
}
