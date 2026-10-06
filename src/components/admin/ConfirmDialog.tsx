import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** Accessible confirmation for consequential actions. Focus starts on Cancel; Escape cancels. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, loading, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-cancel]')?.focus()
      }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button data-cancel type="button" variant="outline" size="lg" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="lg" variant={destructive ? 'destructive' : 'default'} disabled={loading} onClick={onConfirm}>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
