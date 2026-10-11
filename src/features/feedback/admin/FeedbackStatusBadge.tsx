import { StatusBadge, type BadgeTone } from '@/components/admin/StatusBadge'
import type { FeedbackStatus } from '@/types'

const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'gold' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'neutral' },
}

export const FeedbackStatusBadge = ({ status }: { status: FeedbackStatus }) => (
  <StatusBadge tone={FEEDBACK_STATUS[status].tone}>{FEEDBACK_STATUS[status].label}</StatusBadge>
)
