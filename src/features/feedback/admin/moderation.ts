import { isRepositoryError } from '@/services/errors'
import type { FeedbackStatus } from '@/types'

export interface ModerationAction {
  to: FeedbackStatus
  label: string
  /** Past tense for the success message. */
  done: string
  confirmBody: string
  destructive: boolean
}

const ACTIONS: Record<FeedbackStatus, ModerationAction> = {
  approved: {
    to: 'approved', label: 'Approve', done: 'approved', destructive: false,
    confirmBody: 'It will appear on the public Feedback page and in the Home page testimonials straight away.',
  },
  rejected: {
    to: 'rejected', label: 'Reject', done: 'rejected', destructive: true,
    confirmBody: 'It will not be shown publicly. If it is currently public, it is removed from the website straight away. You can change this decision later.',
  },
  pending: {
    to: 'pending', label: 'Return to pending', done: 'returned to pending', destructive: false,
    confirmBody: 'It will not be shown publicly until it is approved again. If it is currently public, it is removed from the website straight away.',
  },
}

/** Every decision other than the current one. Any status may follow any other, so a decision can be reversed. */
export const moderationActions = (current: FeedbackStatus): ModerationAction[] =>
  (['approved', 'rejected', 'pending'] as const).filter((s) => s !== current).map((s) => ACTIONS[s])

export function moderationErrorMessage(e: unknown): string {
  if (isRepositoryError(e, 'not_found')) return 'This feedback no longer exists, so it could not be changed.'
  if (isRepositoryError(e, 'no_change')) return 'Nothing changed: it already had that status. The list has been refreshed.'
  if (isRepositoryError(e, 'invalid_status')) return 'That status is not supported.'
  if (isRepositoryError(e, 'invalid_id')) return 'This feedback could not be identified, so it could not be changed.'
  return 'Could not save the decision. Nothing was changed. Please try again.'
}
