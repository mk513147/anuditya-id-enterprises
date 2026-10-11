import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeOrderReference } from '@/lib/orderReference'
import { trackOrderSchema, type TrackOrderValues } from '@/validations/jobStatus'

export interface TrackOrderQuery {
  orderNo: string
  trackingCode: string
}

interface Props {
  /** Prefill for the order number only (a tracking code is never taken from a link). */
  initialValue?: string
  busy?: boolean
  autoFocus?: boolean
  onSubmit: (query: TrackOrderQuery) => void
}

/**
 * The order number AND the tracking code are both required: order numbers are sequential and guessable, the code is
 * the secret. The code stays in this form's memory only; it is never written to the URL, history or browser storage.
 */
export function TrackOrderForm({ initialValue = '', busy, autoFocus, onSubmit }: Props) {
  const {
    register, handleSubmit,
    formState: { errors },
  } = useForm<TrackOrderValues>({
    resolver: zodResolver(trackOrderSchema),
    mode: 'onSubmit',
    defaultValues: { reference: initialValue, trackingCode: '' },
  })

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit({ orderNo: normalizeOrderReference(v.reference), trackingCode: v.trackingCode }))}
      noValidate
      autoComplete="off"
      className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6"
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FormField id="jt-ref" label="Job / Order No." required hint="For example: JOB-2026-0003" error={errors.reference?.message}>
          {(c) => (
            <Input
              {...c}
              {...register('reference')}
              autoFocus={autoFocus}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              placeholder="Enter your order number"
              className="h-12 w-full text-base"
            />
          )}
        </FormField>
        <FormField id="jt-code" label="Tracking code" required hint="25 letters and numbers, from your order confirmation" error={errors.trackingCode?.message}>
          {(c) => (
            <Input
              {...c}
              {...register('trackingCode')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              placeholder="ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2"
              className="h-12 w-full font-mono text-base"
            />
          )}
        </FormField>
      </div>
      <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full sm:w-auto sm:min-w-44">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {busy ? 'Checking…' : 'Check Status'}
      </Button>
    </form>
  )
}
