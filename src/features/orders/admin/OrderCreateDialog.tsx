import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useSchools } from '@/features/schools/hooks'
import { usePublicServices } from '@/features/services/hooks'
import { localDateISO } from '@/lib/format'
import { describeError, isRepositoryError } from '@/services/errors'
import type { CreatedOrder } from '@/services/types'
import { orderInputSchema, type OrderFormValues } from '@/validations/order'
import { useCreateOrder } from '../hooks'
import { TrackingCodeReveal } from './TrackingCodeReveal'

const inputCls = 'h-11 text-base'

function OrderForm({ onCreated, onClose }: { onCreated: (created: CreatedOrder) => void; onClose: () => void }) {
  const create = useCreateOrder()
  const { data: schools = [] } = useSchools({ status: 'active' })
  const { data: services = [] } = usePublicServices()
  const [today] = useState(() => localDateISO(new Date().toISOString())) // fixed for the life of the form
  const {
    register, handleSubmit, setError, control,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderInputSchema),
    mode: 'onTouched',
    defaultValues: { schoolId: '', customer: '', service: '', quantity: '', orderDate: today, expectedDelivery: '', notes: '' },
  })
  const schoolId = useWatch({ control, name: 'schoolId' })
  const busy = isSubmitting || create.isPending

  const onSubmit = handleSubmit(async (v) => {
    try {
      const created = await create.mutateAsync({
        schoolId: v.schoolId || undefined,
        customer: v.schoolId ? undefined : v.customer,
        service: v.service,
        quantity: Number(v.quantity),
        orderDate: v.orderDate,
        expectedDelivery: v.expectedDelivery,
        notes: v.notes || undefined,
      })
      onCreated(created)
    } catch (e) {
      if (isRepositoryError(e, 'invalid_input') && e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) setError(field as keyof OrderFormValues, { message })
      } else {
        toast.error(describeError(e, 'Could not create the order. Please try again.'))
      }
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="grid gap-x-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField id="or-school" label="School" hint="Leave empty for a customer who is not a school" error={errors.schoolId?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('schoolId')}>
              <option value="">No school (enter the customer below)</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      {!schoolId && (
        <div className="sm:col-span-2">
          <FormField id="or-customer" label="Customer name" required error={errors.customer?.message}>
            {(c) => <Input {...c} {...register('customer')} autoComplete="off" maxLength={100} className={inputCls} />}
          </FormField>
        </div>
      )}
      <FormField id="or-service" label="Service" required error={errors.service?.message}>
        {(c) => <Input {...c} {...register('service')} list="or-service-options" autoComplete="off" maxLength={100} className={inputCls} />}
      </FormField>
      <datalist id="or-service-options">
        {services.map((s) => <option key={s.id} value={s.title} />)}
      </datalist>
      <FormField id="or-qty" label="Quantity" required error={errors.quantity?.message}>
        {(c) => <Input {...c} {...register('quantity')} type="number" inputMode="numeric" min={1} step={1} className={inputCls} />}
      </FormField>
      <FormField id="or-date" label="Order date" required error={errors.orderDate?.message}>
        {(c) => <Input {...c} {...register('orderDate')} type="date" className={`block ${inputCls}`} />}
      </FormField>
      <FormField id="or-due" label="Expected delivery" required error={errors.expectedDelivery?.message}>
        {(c) => <Input {...c} {...register('expectedDelivery')} type="date" className={`block ${inputCls}`} />}
      </FormField>
      <div className="sm:col-span-2">
        <FormField id="or-notes" label="Internal notes" hint="Visible to the administrator only, never to customers" error={errors.notes?.message}>
          {(c) => <Textarea {...c} {...register('notes')} rows={2} maxLength={1000} autoComplete="off" className="min-h-20 text-base" />}
        </FormField>
      </div>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Create order
        </Button>
      </div>
    </form>
  )
}

/** Create an order; on success the one-time tracking code is shown in the same dialog. */
export function OrderCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [created, setCreated] = useState<CreatedOrder | null>(null)
  const close = () => {
    setCreated(null) // drop the code from memory as soon as the dialog closes
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{created ? 'Order created' : 'New order'}</DialogTitle>
          <DialogDescription>
            {created ? 'Share the order number and tracking code with the customer now.' : 'The order number and a private tracking code are generated automatically. Fields marked * are required.'}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <TrackingCodeReveal orderNo={created.order.orderNo} code={created.trackingCode} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild variant="outline" size="lg">
                <Link to={`/admin/orders/${created.order.id}`} onClick={close}>Open the order</Link>
              </Button>
              <Button size="lg" onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          open && <OrderForm onCreated={setCreated} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
