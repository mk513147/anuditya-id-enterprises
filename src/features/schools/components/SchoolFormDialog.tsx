import { zodResolver } from '@hookform/resolvers/zod'
import { Link2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { schoolLink } from '@/lib/schoolLinks'
import { slugify } from '@/lib/slug'
import { isRepositoryError } from '@/services/errors'
import type { School, SchoolInput } from '@/types'
import { schoolSchema, type SchoolFormValues } from '@/validations/school'
import { normalizeMobile } from '@/validations/student'
import { useCreateSchool, useUpdateSchool } from '../hooks'

const inputCls = 'h-11 text-base'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit mode. Absent = add mode. */
  school?: School
}

function SchoolForm({ school, onClose }: { school?: School; onClose: () => void }) {
  const create = useCreateSchool()
  const update = useUpdateSchool()
  const editing = !!school
  // In add mode the link name follows the school name until the admin types their own.
  const [slugEdited, setSlugEdited] = useState(editing)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [pending, setPending] = useState<SchoolInput | null>(null)

  const {
    register, handleSubmit, setValue, setError, clearErrors, control,
    formState: { errors, isSubmitting },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    mode: 'onTouched',
    defaultValues: {
      name: school?.name ?? '',
      slug: school?.slug ?? '',
      code: school?.code ?? '',
      contactPerson: school?.contactPerson ?? '',
      phone: school?.phone ?? '',
      email: school?.email ?? '',
      address: school?.address ?? '',
    },
  })

  const slug = useWatch({ control, name: 'slug' })
  const busy = isSubmitting || create.isPending || update.isPending

  const save = async (input: SchoolInput) => {
    try {
      if (school) await update.mutateAsync({ id: school.id, input })
      else await create.mutateAsync(input)
      toast.success(school ? 'School updated' : 'School added', { description: input.name })
      onClose()
    } catch (e) {
      setPending(null)
      if (isRepositoryError(e, 'duplicate_code')) {
        setError('code', { message: 'This school code is already used by another school.' }, { shouldFocus: true })
      } else if (isRepositoryError(e, 'duplicate_slug')) {
        setError('slug', { message: 'This link name is already used by another school.' }, { shouldFocus: true })
        setSuggestion(e.suggestion ?? null)
      } else {
        toast.error('Could not save the school. Please try again.')
      }
    }
  }

  const onSubmit = handleSubmit(async (v) => {
    const input: SchoolInput = {
      name: v.name,
      slug: v.slug,
      code: v.code.toUpperCase(),
      contactPerson: v.contactPerson,
      phone: normalizeMobile(v.phone),
      email: v.email || undefined,
      address: v.address || undefined,
    }
    // Changing the link name breaks links already shared with the school, so make that explicit.
    if (school && v.slug !== school.slug) setPending(input)
    else await save(input)
  })

  const nameField = register('name', {
    onChange: (e) => {
      if (!slugEdited) {
        setValue('slug', e.target.value.trim() ? slugify(e.target.value) : '')
        setSuggestion(null)
      }
    },
  })
  const slugField = register('slug', {
    onChange: () => {
      setSlugEdited(true)
      setSuggestion(null)
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit school' : 'Add school'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Update the school details.' : 'Create a school and its public student submission link.'} Fields marked * are required.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate aria-busy={busy} className="grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField id="sc-name" label="School name" required error={errors.name?.message}>
            {(c) => <Input {...c} {...nameField} autoComplete="off" maxLength={100} className={inputCls} />}
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField
            id="sc-slug"
            label="Link name"
            required
            hint={`Public link: ${schoolLink(slug || 'link-name')}`}
            error={errors.slug?.message}
          >
            {(c) => <Input {...c} {...slugField} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} className={inputCls} />}
          </FormField>
          {suggestion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="-mt-1 mb-2 h-10"
              onClick={() => {
                setValue('slug', suggestion, { shouldValidate: true })
                clearErrors('slug')
                setSuggestion(null)
              }}
            >
              <Link2 aria-hidden /> Use “{suggestion}” instead
            </Button>
          )}
          {editing && <p className="-mt-1 mb-2 text-xs text-muted-ink">Changing the link name stops the old link from working.</p>}
        </div>

        <FormField id="sc-code" label="School code" required hint="Letters, numbers, hyphen. e.g. STM-001" error={errors.code?.message}>
          {(c) => <Input {...c} {...register('code')} autoComplete="off" autoCapitalize="characters" maxLength={12} className={inputCls} />}
        </FormField>
        <FormField id="sc-contact" label="Contact person" required error={errors.contactPerson?.message}>
          {(c) => <Input {...c} {...register('contactPerson')} autoComplete="off" maxLength={80} className={inputCls} />}
        </FormField>
        <FormField id="sc-phone" label="Phone" required hint="10-digit Indian mobile number" error={errors.phone?.message}>
          {(c) => <Input {...c} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" maxLength={17} className={inputCls} />}
        </FormField>
        <FormField id="sc-email" label="Email" error={errors.email?.message}>
          {(c) => <Input {...c} {...register('email')} type="email" autoComplete="off" maxLength={120} className={inputCls} />}
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="sc-address" label="Address" error={errors.address?.message}>
            {(c) => <Textarea {...c} {...register('address')} rows={2} maxLength={250} autoComplete="off" className="min-h-20 text-base" />}
          </FormField>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? 'Save changes' : 'Add school'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Change the school link?"
        description={
          <>
            The old link <strong className="break-all">{school ? schoolLink(school.slug) : ''}</strong> will stop working. Anyone who still uses it will see a “link not found” page. Make sure you share the new link with the school.
          </>
        }
        confirmLabel="Change link and save"
        loading={update.isPending}
        onConfirm={() => pending && void save(pending)}
      />
    </>
  )
}

export function SchoolFormDialog({ open, onOpenChange, school }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form is mounted only while open, so every open starts from a clean state. */}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <SchoolForm key={school?.id ?? 'new'} school={school} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
