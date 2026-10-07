import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeOrderReference } from '@/lib/orderReference'
import { trackOrderSchema, type TrackOrderValues } from '@/validations/jobStatus'

interface Props {
  /** Prefill, e.g. from the ?ref= query string. */
  initialValue?: string
  /** An error about a prefilled value that failed validation before any lookup. */
  initialError?: string
  busy?: boolean
  autoFocus?: boolean
  onSubmit: (reference: string) => void
}

export function TrackOrderForm({ initialValue = '', initialError, busy, autoFocus, onSubmit }: Props) {
  const {
    register, handleSubmit,
    formState: { errors },
  } = useForm<TrackOrderValues>({
    resolver: zodResolver(trackOrderSchema),
    mode: 'onSubmit',
    defaultValues: { reference: initialValue },
  })
  const message = errors.reference?.message ?? initialError

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(normalizeOrderReference(v.reference)))} noValidate className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
      <FormField id="jt-ref" label="Job / Order / Reference No." required hint="For example: JOB-2026-0003" error={message}>
        {(c) => (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              {...c}
              {...register('reference')}
              autoFocus={autoFocus}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              placeholder="Enter your job or order number"
              className="h-12 w-full text-base sm:flex-1"
            />
            <Button type="submit" size="lg" disabled={busy} className="sm:min-w-44">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
              {busy ? 'Checking…' : 'Check Status'}
            </Button>
          </div>
        )}
      </FormField>
    </form>
  )
}
