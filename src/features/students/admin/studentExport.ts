import { exportDate } from '@/lib/download'
import { buildWorkbook, type XlsxColumn } from '@/lib/xlsx'
import type { AdminStudent } from '@/services/types'

const APPROVAL_LABEL = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' } as const

/**
 * Exactly these columns are exported (the same set the CSV export had). Internal ids, storage paths and photo links are
 * deliberately not included. The export is personal data about students: it is generated in the browser for the
 * signed-in administrator only, from rows the database lets only the administrator read.
 */
export const STUDENT_EXPORT_COLUMNS: XlsxColumn<AdminStudent>[] = [
  { header: 'Reference No', value: (s) => s.referenceNo, width: 18 },
  { header: 'Review status', value: (s) => APPROVAL_LABEL[s.approvalStatus] },
  { header: 'Record status', value: (s) => (s.isArchived ? 'Archived' : 'Active') },
  { header: 'School', value: (s) => s.schoolName },
  { header: 'School code', value: (s) => s.schoolCode },
  { header: 'Name', value: (s) => s.name },
  { header: "Father's name", value: (s) => s.fatherName },
  { header: "Mother's name", value: (s) => s.motherName },
  { header: 'Date of birth', value: (s) => s.dob, type: 'date', width: 14 },
  { header: 'Class', value: (s) => s.className },
  { header: 'Section', value: (s) => s.section },
  { header: 'Roll No', value: (s) => s.rollNo },
  { header: 'Admission No', value: (s) => s.admissionNo },
  { header: 'Mobile', value: (s) => s.mobile, width: 14 },
  { header: 'Address', value: (s) => s.address },
  { header: 'Blood group', value: (s) => s.bloodGroup },
  { header: 'House', value: (s) => s.houseName },
  { header: 'House colour', value: (s) => s.houseColour },
  { header: 'Bus route', value: (s) => s.busRoute },
  { header: 'Bus stoppage', value: (s) => s.busStoppage },
  { header: 'Submitted at (IST)', value: (s) => s.submittedAt, type: 'datetime', width: 18 },
]

export const STUDENT_SHEET_NAME = 'Students'

export const studentsWorkbook = (rows: AdminStudent[]) =>
  buildWorkbook([{ name: STUDENT_SHEET_NAME, columns: STUDENT_EXPORT_COLUMNS, rows }], { title: 'Anuditya ID – students' })

export const studentExportFilename = (now = new Date()) => `anuditya-students_${exportDate(now)}.xlsx`
