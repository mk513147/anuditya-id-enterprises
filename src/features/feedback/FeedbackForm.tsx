import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { waMessages } from '@/lib/whatsapp'
import { FEEDBACK_MESSAGE_MAX, feedbackSchema, type FeedbackFormValues } from '@/validations/feedback'
import { useSubmitFeedback } from './hooks'
import { RatingInput } from './RatingInput'

/**
 * The form is unmounted by the page on success, so it is never reset by a failure: after an error
 * everything the visitor typed is still there and "Try Again" resubmits it.
 */
export function FeedbackForm({ onSubmitted }: { onSubmitted: () => void }) {
  const submit = useSubmitFeedback()
  const inFlight = useRef(false) // synchronous guard: state is stale between two rapid clicks
  const {
    register, control, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    mode: 'onTouched',
    defaultValues: { name: '', organization: '', message: '' },
  })
  const length = useWatch({ control, name: 'message' })?.length ?? 0
  const busy = isSubmitting || submit.isPending

  const send = async (v: FeedbackFormValues) => {
    if (inFlight.current) return // ignore repeated clicks while a request is pending
    inFlight.current = true
    try {
      await submit.mutateAsync({ name: v.name, organization: v.organization || undefined, rating: v.rating as 1 | 2 | 3 | 4 | 5, message: v.message })
      onSubmitted()
    } catch {
      // Surfaced through submit.isError below; the form keeps every value so the visitor can retry.
    } finally {
      inFlight.current = false
    }
  }
  // Invoked from event handlers only (the guard above reads a ref, which must not happen during render).
  const submitForm = (e?: React.BaseSyntheticEvent) => void handleSubmit(send)(e)

  return (
    <form onSubmit={submitForm} noValidate aria-busy={busy} className="space-y-1">
      <p className="mb-3 text-sm text-muted-ink">
        Fields marked <span className="font-bold text-destructive">*</span> are required. We do not ask for a phone number or e-mail.
      </p>

      <FormField id="fb-name" label="Your name" required error={errors.name?.message}>
        {(c) => <Input {...c} {...register('name')} autoComplete="name" maxLength={60} className="h-11 text-base" />}
      </FormField>

      <FormField id="fb-org" label="School / College / Organization" hint="Optional" error={errors.organization?.message}>
        {(c) => <Input {...c} {...register('organization')} autoComplete="organization" maxLength={100} className="h-11 text-base" />}
      </FormField>

      <Controller
        control={control}
        name="rating"
        render={({ field }) => <RatingInput id="fb-rating" value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.rating?.message} />}
      />

      <FormField id="fb-message" label="Your feedback" required error={errors.message?.message}>
        {(c) => (
          <>
            <Textarea {...c} {...register('message')} rows={5} maxLength={FEEDBACK_MESSAGE_MAX + 50} placeholder="Tell us about your experience" className="min-h-32 text-base" />
            <p className="text-right text-xs text-muted-ink" aria-hidden>
              {length}/{FEEDBACK_MESSAGE_MAX}
            </p>
          </>
        )}
      </FormField>

      {submit.isError && !busy && (
        <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-red-50 p-4">
          <p className="flex items-start gap-2 font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            Something went wrong while sending your feedback.
          </p>
          <p className="mt-1 text-sm text-ink">Your feedback is still here. Please try again, or message us on WhatsApp.</p>
          <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
            <Button type="button" variant="destructive" className="h-11" onClick={() => submitForm()}>
              Try Again
            </Button>
            <WhatsAppButton className="h-11" label="WhatsApp Us" message={waMessages.general()} />
          </div>
        </div>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto sm:min-w-56">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? 'Sending…' : 'Submit Feedback'}
      </Button>
    </form>
  )
}
