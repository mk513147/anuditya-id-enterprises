import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { isRepositoryError } from '@/services/errors'
import type { Advertisement } from '@/types'
import { ADVERTISEMENT_ICONS, advertisementFormSchema, toAdvertisementInput, type AdvertisementFormValues } from '@/validations/advertisement'
import { applyFieldErrors, formDefaults } from './adForm'
import { useCreateAdvertisement, useUpdateAdvertisement } from '../adminHooks'

const inputCls = 'h-11 text-base'
function Check({ id, label, hint, ...rest }: { id: string; label: string; hint: string } & React.ComponentProps<'input'>) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-royal-600)]" aria-describedby={`${id}-hint`} {...rest} />
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="block font-semibold text-navy-900">{label}</span>
        <span id={`${id}-hint`} className="block text-xs text-muted-ink">{hint}</span>
      </label>
    </div>
  )
}

function AdForm({ ad, onClose }: { ad?: Advertisement; onClose: () => void }) {
  const create = useCreateAdvertisement()
  const update = useUpdateAdvertisement()
  const editing = !!ad
  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<AdvertisementFormValues>({ resolver: zodResolver(advertisementFormSchema), mode: 'onTouched', defaultValues: formDefaults(ad) })
  const busy = isSubmitting || create.isPending || update.isPending
  const singleFlight = useSingleFlight()

  const onSubmit = handleSubmit((values) =>
    singleFlight(async () => {
      const input = toAdvertisementInput(values)
      try {
        if (ad) await update.mutateAsync({ id: ad.id, patch: input })
        else await create.mutateAsync(input)
        toast.success(ad ? 'Advertisement updated' : 'Advertisement added', { description: input.title })
        onClose()
      } catch (e) {
        if (!applyFieldErrors(e, setError)) {
          toast.error(isRepositoryError(e, 'not_found') ? 'This advertisement no longer exists.' : 'Could not save the advertisement. Nothing was changed. Please try again.')
        }
      }
    }),
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit advertisement' : 'Add advertisement'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Change any detail. Everything you do not touch stays as it is.' : 'New advertisements start as drafts and are not public until published.'} Fields marked * are required.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField id="ad-title" label="Title" required error={errors.title?.message}>
            {(c) => <Input {...c} {...register('title')} autoComplete="off" maxLength={80} className={inputCls} />}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField id="ad-description" label="Description" required hint="Up to 300 characters." error={errors.description?.message}>
            {(c) => <Textarea {...c} {...register('description')} rows={3} maxLength={300} className="min-h-24 text-base" />}
          </FormField>
        </div>
        <FormField id="ad-offer" label="Offer label" hint="Optional short badge, e.g. “Early booking offer”." error={errors.offer?.message}>
          {(c) => <Input {...c} {...register('offer')} autoComplete="off" maxLength={60} className={inputCls} />}
        </FormField>
        <FormField id="ad-whatsapp" label="WhatsApp enquiry topic" required hint="Used to start the visitor’s WhatsApp message." error={errors.whatsappMessage?.message}>
          {(c) => <Input {...c} {...register('whatsappMessage')} autoComplete="off" maxLength={120} className={inputCls} />}
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="ad-image" label="Image link" hint="A web address (https://…) of an image that is already online. Images cannot be uploaded in this prototype; without a link a branded placeholder is shown." error={errors.image?.message}>
            {(c) => <Input {...c} {...register('image')} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={500} className={inputCls} />}
          </FormField>
        </div>
        <FormField id="ad-icon" label="Placeholder icon" required hint="Shown when there is no image." error={errors.icon?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('icon')}>
              {ADVERTISEMENT_ICONS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="hidden sm:block" />
        <FormField id="ad-start" label="Start date" hint="First day it can be public (India time). Leave empty to start immediately." error={errors.startDate?.message}>
          {(c) => <Input {...c} {...register('startDate')} type="date" className={`${inputCls} block`} />}
        </FormField>
        <FormField id="ad-end" label="End date" hint="Last day it can be public, until the end of that day. Leave empty for no end." error={errors.endDate?.message}>
          {(c) => <Input {...c} {...register('endDate')} type="date" className={`${inputCls} block`} />}
        </FormField>

        <div className="mb-3 grid gap-3 sm:col-span-2 sm:grid-cols-3">
          <Check id="adf-published" label="Published" hint="Off = draft" {...register('isPublished')} />
          <Check id="adf-active" label="Enabled" hint="Off = hidden" {...register('active')} />
          <Check id="adf-featured" label="Featured" hint="Shown first on Home" {...register('featured')} />
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? 'Save changes' : 'Add advertisement'}
          </Button>
        </div>
      </form>
    </>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit mode. Absent = add mode. */
  ad?: Advertisement
}

export function AdFormDialog({ open, onOpenChange, ad }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form is mounted only while open, so every open starts from a clean state. */}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {open && <AdForm ad={ad} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
