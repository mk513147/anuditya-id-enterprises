import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-2xl bg-royal-100/70', className)} />
}

export function ErrorState({ message = 'Something went wrong while loading this section.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-red-50 p-6 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-dashed bg-white p-8 text-center">
      <Inbox className="size-8 text-muted-ink" aria-hidden />
      <p className="font-display font-bold text-navy-900">{title}</p>
      {text && <p className="text-sm text-muted-ink">{text}</p>}
      {action}
    </div>
  )
}
