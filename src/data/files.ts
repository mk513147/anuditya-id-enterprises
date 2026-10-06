import type { UploadedFile } from '@/types'

/** DEMO DATA: fictional uploaded-file metadata. No actual files exist. */
export const FILES_DATA: UploadedFile[] = [
  { id: 'fil-1', referenceNo: 'FILE-2026-00001', originalName: 'StMarys_Students_2026.xlsx', storagePath: 'uploads/2026/FILE-2026-00001/StMarys_Students_2026.xlsx', type: 'xlsx', sizeBytes: 254_976, uploadedAt: '2026-06-09T10:15:00.000Z', schoolId: 'sch-stmarys', customer: "St. Mary's School" },
  { id: 'fil-2', referenceNo: 'FILE-2026-00002', originalName: 'GreenValley_Batch_A.csv', storagePath: 'uploads/2026/FILE-2026-00002/GreenValley_Batch_A.csv', type: 'csv', sizeBytes: 48_120, uploadedAt: '2026-06-30T16:40:00.000Z', schoolId: 'sch-greenvalley', customer: 'Green Valley College' },
  { id: 'fil-3', referenceNo: 'FILE-2026-00003', originalName: 'Sunrise_List.xls', storagePath: 'uploads/2026/FILE-2026-00003/Sunrise_List.xls', type: 'xls', sizeBytes: 122_880, uploadedAt: '2026-09-04T09:05:00.000Z', schoolId: 'sch-sunrise', customer: 'Sunrise Public School' },
  { id: 'fil-4', referenceNo: 'FILE-2026-00004', originalName: 'Lotus_Class8.xlsx', storagePath: 'uploads/2026/FILE-2026-00004/Lotus_Class8.xlsx', type: 'xlsx', sizeBytes: 98_304, uploadedAt: '2026-09-19T13:30:00.000Z', schoolId: 'sch-lotus', customer: 'Lotus International School' },
]
