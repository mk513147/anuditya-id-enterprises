import type { UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { useActiveSchools } from '@/features/schools/hooks'

/** The active-school picker of the public forms (stores the school's ID; the name is only shown). */
export function SchoolSelect({ id, error, field, hint = 'Choose the school this file is for.' }: { id: string; error?: string; field: UseFormRegisterReturn; hint?: string }) {
  const { data: schools, isPending, isError, refetch } = useActiveSchools()
  const noSchools = !isPending && !isError && schools.length === 0
  return (
    <div>
      <FormField
        id={id}
        label="School name"
        required
        hint={noSchools || isError ? undefined : hint}
        error={error ?? (isError ? 'Could not load the school list.' : undefined)}
      >
        {(c) => (
          <NativeSelect {...c} {...field} disabled={isPending || isError || noSchools}>
            <option value="" disabled>
              {isPending ? 'Loading schools…' : noSchools ? 'No schools available' : 'Select school'}
            </option>
            {schools?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {isError && (
        <Button type="button" variant="outline" size="sm" className="-mt-1 mb-2 h-10" onClick={() => void refetch()}>
          Try loading again
        </Button>
      )}
      {noSchools && <p className="-mt-1 mb-2 text-sm text-ink">No schools are accepting files right now. Please contact us on WhatsApp.</p>}
    </div>
  )
}
