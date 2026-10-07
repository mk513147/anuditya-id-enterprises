import { ADVERTISEMENTS_DATA } from '@/data/advertisements'
import { FEEDBACK_DATA } from '@/data/feedback'
import { FILES_DATA } from '@/data/files'
import { ORDERS_DATA } from '@/data/orders'
import { SCHOOLS_DATA } from '@/data/schools'
import { STUDENTS_DATA } from '@/data/students'
import type { Advertisement, Feedback, Order, School, Student, UploadedFile } from '@/types'

/**
 * The prototype's in-memory "database", shared by every mock repository so that, for example,
 * a student submitted on the public form is counted on the admin dashboard in the same session.
 *
 * It is plain module state: it is reset on page refresh and is NEVER written to localStorage
 * or any other browser storage. A real backend replaces this whole file.
 */
export const db = {
  schools: SCHOOLS_DATA.map((s): School => ({ ...s })),
  students: STUDENTS_DATA.map((s): Student => ({ ...s })),
  orders: ORDERS_DATA.map((o): Order => ({ ...o })),
  files: FILES_DATA.map((f): UploadedFile => ({ ...f })),
  advertisements: ADVERTISEMENTS_DATA.map((a): Advertisement => ({ ...a })),
  feedback: FEEDBACK_DATA.map((f): Feedback => ({ ...f })),
}

export const pad5 = (n: number) => String(n).padStart(5, '0')
