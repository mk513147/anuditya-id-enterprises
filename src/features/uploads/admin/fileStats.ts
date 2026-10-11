import type { FileListResult } from '@/services/types'

/** Overall (unfiltered) figures for the stat cards, all derived from stored records. */
export function fileStatGroups({ total, totalBytes, byType, byReview }: FileListResult['counts']) {
  return {
    total,
    excel: byType.xlsx + byType.xls,
    csv: byType.csv,
    totalBytes,
    pending: byReview.pending,
    corrections: byReview.corrections_required,
    approved: byReview.approved,
    rejected: byReview.rejected,
  }
}
