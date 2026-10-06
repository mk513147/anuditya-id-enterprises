import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { schoolPath } from '@/lib/schoolLinks'
import type { School } from '@/types'
import { useSetSchoolActive } from '../hooks'

/** Confirms activating/deactivating a school. `school` null = closed. */
export function SchoolStatusDialog({ school, onClose }: { school: School | null; onClose: () => void }) {
  const setActive = useSetSchoolActive()
  const activating = school ? !school.isActive : false

  const confirm = async () => {
    if (!school) return
    try {
      await setActive.mutateAsync({ id: school.id, isActive: activating })
      toast.success(activating ? 'School activated' : 'School deactivated', { description: school.name })
      onClose()
    } catch {
      toast.error('Could not change the school status. Please try again.')
    }
  }

  return (
    <ConfirmDialog
      open={!!school}
      onOpenChange={(o) => !o && onClose()}
      title={activating ? `Activate ${school?.name}?` : `Deactivate ${school?.name}?`}
      description={
        activating ? (
          <>
            The link <strong>{school ? schoolPath(school.slug) : ''}</strong> will start accepting student submissions again, and the school will appear in the student form dropdown.
          </>
        ) : (
          <>
            The link <strong>{school ? schoolPath(school.slug) : ''}</strong> will stop accepting submissions and the school will disappear from the student form dropdown. Existing records are kept.
          </>
        )
      }
      confirmLabel={activating ? 'Activate school' : 'Deactivate school'}
      destructive={!activating}
      loading={setActive.isPending}
      onConfirm={() => void confirm()}
    />
  )
}
