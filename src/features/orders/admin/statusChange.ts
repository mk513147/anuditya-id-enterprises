import { isRepositoryError } from '@/services/errors'
import { ORDER_STATUSES, type OrderStatus } from '@/types'

export interface StatusChange {
  direction: 'forward' | 'backward' | 'none'
  /** How many workflow positions the order moves (0 when unchanged). */
  steps: number
}

/** Pure description of a proposed move, used to word the confirmation. It never changes anything. */
export function describeStatusChange(from: OrderStatus, to: OrderStatus): StatusChange {
  const diff = ORDER_STATUSES.indexOf(to) - ORDER_STATUSES.indexOf(from)
  return { direction: diff > 0 ? 'forward' : diff < 0 ? 'backward' : 'none', steps: Math.abs(diff) }
}

/** Extra warning shown in the confirmation, or null when the move is a plain single step forward. */
export function changeWarning({ direction, steps }: StatusChange): string | null {
  if (direction === 'backward') return 'This moves the order back to an earlier stage. Use it to correct a mistake; customers will see the earlier status.'
  if (direction === 'forward' && steps > 1) return `This skips ${steps - 1} ${steps - 1 === 1 ? 'stage' : 'stages'}.`
  return null
}

/** Maps a repository failure to a message an admin can act on. */
export function statusErrorMessage(e: unknown): string {
  if (isRepositoryError(e, 'not_found')) return 'This order no longer exists, so its status could not be changed.'
  if (isRepositoryError(e, 'invalid_status')) return 'That status is not supported. Choose one of the listed stages.'
  if (isRepositoryError(e, 'no_change')) return 'The order is already in that status. Nothing was changed.'
  if (isRepositoryError(e, 'invalid_id')) return 'This order could not be identified, so its status could not be changed.'
  return 'Could not update the status. Nothing was changed. Please try again.'
}
