import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePublicServices } from '@/features/services/hooks'
import { BUSINESS } from '@/lib/business'
import { delay } from '@/lib/delay'
import { quoteSchema, type QuoteFormValues } from '@/validations/quote'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultService?: string
}

/** Mounted only while the dialog is open, so its state resets on every open. */
function QuoteForm({ onClose, defaultService }: { onClose: () => void; defaultService?: string }) {
  const { data: services = [] } = usePublicServices()
  const [message, setMessage] = useState<string | null>(null)
  const {
    register, handleSubmit, control, formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { name: '', mobile: '', organization: '', service: defaultService ?? '', details: '' },
  })

  const onSubmit = async (v: QuoteFormValues) => {
    await delay(900) // mock request
    const lines = [
      `Hello ${BUSINESS.name}, I would like a quotation.`,
      `Service: ${v.service}`,
      `Name: ${v.name}`,
      `Mobile: ${v.mobile}`,
      v.organization && `School/Organization: ${v.organization}`,
      v.details && `Details: ${v.details}`,
    ].filter(Boolean)
    setMessage(lines.join('\n'))
    toast.success('Quote request prepared')
  }

  if (message) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
        <DialogHeader className="items-center text-center">
          <DialogTitle>Your quote request is ready</DialogTitle>
          <DialogDescription>Send it on WhatsApp so our team can reply with pricing quickly.</DialogDescription>
        </DialogHeader>
        <WhatsAppButton size="lg" className="w-full" message={message} label="Send on WhatsApp" />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Get a Quote</DialogTitle>
        <DialogDescription>Tell us what you need. We will get back to you with pricing.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-1">
        <FormField id="q-name" label="Your name" required error={errors.name?.message}>
          {(c) => <Input {...c} autoComplete="name" className="h-11 text-base" {...register('name')} />}
        </FormField>
        <FormField id="q-mobile" label="Mobile number" required error={errors.mobile?.message}>
          {(c) => <Input {...c} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} className="h-11 text-base" {...register('mobile')} />}
        </FormField>
        <FormField id="q-org" label="School / College / Organization">
          {(c) => <Input {...c} className="h-11 text-base" {...register('organization')} />}
        </FormField>
        <FormField id="q-service" label="Service" required error={errors.service?.message}>
          {(c) => (
            <Controller
              control={control}
              name="service"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={c.id} className="h-11 w-full text-base" aria-invalid={c['aria-invalid']} aria-describedby={c['aria-describedby']}>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.title}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField id="q-details" label="Quantity / details" error={errors.details?.message}>
          {(c) => <Textarea {...c} rows={3} placeholder="e.g. 500 student ID cards with lanyards" className="text-base" {...register('details')} />}
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {isSubmitting ? 'Preparing…' : 'Request Quote'}
        </Button>
      </form>
    </>
  )
}

export function QuoteDialog({ open, onOpenChange, defaultService }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <QuoteForm onClose={() => onOpenChange(false)} defaultService={defaultService} />
      </DialogContent>
    </Dialog>
  )
}
