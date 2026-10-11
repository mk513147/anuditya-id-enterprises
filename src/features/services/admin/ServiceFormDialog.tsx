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
import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { isRepositoryError } from '@/services/errors'
import type { Service } from '@/types'
import { SERVICE_ICONS, serviceFormSchema, toServiceInput, type ServiceFormValues } from '@/validations/service'
import { useCreateService, useUpdateService } from '../adminHooks'
import { applyFieldErrors, formDefaults } from './serviceForm'

const inputCls = 'h-11 text-base'

function ServiceForm({ service, onClose }: { service?: Service; onClose: () => void }) {
  const create = useCreateService()
  const update = useUpdateService()
  const singleFlight = useSingleFlight()
  const editing = !!service
  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({ resolver: zodResolver(serviceFormSchema), mode: 'onTouched', defaultValues: formDefaults(service) })
  const busy = isSubmitting || create.isPending || update.isPending

  const onSubmit = handleSubmit((values) =>
    singleFlight(async () => {
      const input = toServiceInput(values)
      try {
        if (service) await update.mutateAsync({ id: service.id, patch: input })
        else await create.mutateAsync(input)
        toast.success(service ? 'Service updated' : 'Service added', { description: input.title })
        onClose()
      } catch (e) {
        if (!applyFieldErrors(e, setError)) {
          toast.error(isRepositoryError(e, 'not_found') ? 'This service no longer exists.' : 'Could not save the service. Nothing was changed. Please try again.')
        }
      }
    }),
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit service' : 'Add service'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Change any detail. Everything you do not touch stays as it is.' : 'New services appear on the website straight away when enabled, after the existing ones.'} Fields marked * are required.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField id="svc-title" label="Service name" required hint="Customers see this name, and it is used in quote requests and WhatsApp messages." error={errors.title?.message}>
            {(c) => <Input {...c} {...register('title')} autoComplete="off" maxLength={60} className={inputCls} />}
          </FormField>
        </div>
        <FormField id="svc-tagline" label="Short label" required hint="A few words under the name, e.g. “Student & Staff”." error={errors.tagline?.message}>
          {(c) => <Input {...c} {...register('tagline')} autoComplete="off" maxLength={40} className={inputCls} />}
        </FormField>
        <FormField id="svc-form-category" label="Category" required error={errors.category?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('category')}>
              {SERVICE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="svc-description" label="Description" required hint="Up to 250 characters." error={errors.description?.message}>
            {(c) => <Textarea {...c} {...register('description')} rows={3} maxLength={250} className="min-h-24 text-base" />}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField id="svc-image" label="Image link" hint="A web address (https://…) of an image that is already online. Images cannot be uploaded in this prototype; only the link is saved. Without a link a branded placeholder is shown." error={errors.image?.message}>
            {(c) => <Input {...c} {...register('image')} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={500} className={inputCls} />}
          </FormField>
        </div>
        <FormField id="svc-icon" label="Icon" required hint="Shown on the placeholder, and as a small badge on photos." error={errors.icon?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('icon')}>
              {SERVICE_ICONS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="mb-3 flex items-start gap-3 self-start rounded-lg border p-3 sm:mt-7">
          <input id="svc-form-enabled" type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-royal-600)]" aria-describedby="svc-form-enabled-hint" {...register('enabled')} />
          <label htmlFor="svc-form-enabled" className="min-w-0 text-sm">
            <span className="block font-semibold text-navy-900">Enabled</span>
            <span id="svc-form-enabled-hint" className="block text-xs text-muted-ink">Off = hidden from the website and the quote form</span>
          </label>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? 'Save changes' : 'Add service'}
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
  service?: Service
}

export function ServiceFormDialog({ open, onOpenChange, service }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form is mounted only while open, so every open starts from a clean state. */}
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {open && <ServiceForm service={service} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
