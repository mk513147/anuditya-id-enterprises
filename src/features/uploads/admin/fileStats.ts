import type { FileListResult } from '@/services/types'

/** Overall (unfiltered) figures for the stat cards, all derived from stored records. */
export function fileStatGroups({ total, totalBytes, byType }: FileListResult['counts']) {
  return { total, excel: byType.xlsx + byType.xls, csv: byType.csv, totalBytes }
}
