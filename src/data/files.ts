import type { UploadedFile } from '@/types'

/**
 * DEMO DATA: fictional uploaded-file metadata. No actual files exist. Every name, number and address is fictional.
 * fil-1 predates the submission form (no contact details), the others carry the form's fields and a mix of review states.
 */
export const FILES_DATA: UploadedFile[] = [
  {
    id: 'fil-1', referenceNo: 'FILE-2026-00001', originalName: 'StMarys_Students_2026.xlsx', storagePath: 'uploads/2026/FILE-2026-00001/StMarys_Students_2026.xlsx',
    type: 'xlsx', sizeBytes: 254_976, uploadedAt: '2026-06-09T10:15:00.000Z', schoolId: 'sch-stmarys', customer: "St. Mary's School", storageState: 'metadata_only',
    reviewStatus: 'approved', reviewedAt: '2026-06-10T09:00:00.000Z',
  },
  {
    id: 'fil-2', referenceNo: 'FILE-2026-00002', originalName: 'GreenValley_Batch_A.csv', storagePath: 'uploads/2026/FILE-2026-00002/GreenValley_Batch_A.csv',
    type: 'csv', sizeBytes: 48_120, uploadedAt: '2026-06-30T16:40:00.000Z', schoolId: 'sch-greenvalley', customer: 'Green Valley College', storageState: 'metadata_only',
    contactPerson: 'Demo Office Clerk', contactDetails: 'office@example.invalid', category: 'student_data',
    description: 'Batch A student list for the 2026-27 session, first-year courses, for ID cards.',
    reviewStatus: 'approved', reviewNotes: 'Checked. Sent to design.', reviewedAt: '2026-07-01T11:30:00.000Z',
  },
  {
    id: 'fil-3', referenceNo: 'FILE-2026-00003', originalName: 'Sunrise_List.xls', storagePath: 'uploads/2026/FILE-2026-00003/Sunrise_List.xls',
    type: 'xls', sizeBytes: 122_880, uploadedAt: '2026-09-04T09:05:00.000Z', schoolId: 'sch-sunrise', customer: 'Sunrise Public School', storageState: 'metadata_only',
    contactPerson: 'Demo Class Teacher', contactDetails: '9000000031', category: 'data_corrections',
    description: 'Corrected roll numbers for Class 5 A and 5 B, replacing the list sent in August.',
    instructions: 'Please reprint only the changed cards.',
    reviewStatus: 'corrections_required', reviewNotes: 'Class 5 B is missing admission numbers.', reviewedAt: '2026-09-05T10:00:00.000Z',
  },
  {
    id: 'fil-4', referenceNo: 'FILE-2026-00004', originalName: 'Lotus_Class8.xlsx', storagePath: 'uploads/2026/FILE-2026-00004/Lotus_Class8.xlsx',
    type: 'xlsx', sizeBytes: 98_304, uploadedAt: '2026-09-19T13:30:00.000Z', schoolId: 'sch-lotus', customer: 'Lotus International School', storageState: 'metadata_only',
    contactPerson: 'Demo Coordinator', contactDetails: '9000000041', category: 'student_data',
    description: 'Student list for the 2026-27 session, Class 8, for ID card printing.',
    reviewStatus: 'pending',
  },
]
