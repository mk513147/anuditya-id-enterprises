import { delay } from '@/lib/delay'
import type { DashboardRepository } from '../types'
import { db } from './db'

/** Every figure is derived from the same mock tables the rest of the app reads and writes. */
export const mockDashboardRepository: DashboardRepository = {
  async getCounts() {
    await delay(350)
    const { schools, students, orders, files, feedback } = db
    return {
      totalSchools: schools.length,
      activeSchools: schools.filter((s) => s.isActive).length,
      totalStudents: students.filter((s) => !s.isArchived).length, // active records only
      pendingStudentReviews: students.filter((s) => !s.isArchived && s.approvalStatus === 'pending').length,
      pendingOrders: orders.filter((o) => o.status === 'Order Received' || o.status === 'Data Verification').length,
      uploadedFiles: files.length,
      pendingFileReviews: files.filter((f) => f.reviewStatus === 'pending').length,
      awaitingCompletion: orders.filter((o) => o.status !== 'Delivered').length,
      pendingFeedback: feedback.filter((f) => f.status === 'pending').length,
    }
  },

  async getRecentOrders() {
    await delay(300)
    return [...db.orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)).slice(0, 5).map((o) => ({ ...o }))
  },

  async getRecentSchools() {
    await delay(300)
    return [...db.schools]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4)
      .map((s) => ({ id: s.id, name: s.name, code: s.code, isActive: s.isActive, createdAt: s.createdAt, studentCount: db.students.filter((st) => st.schoolId === s.id && !st.isArchived).length }))
  },
}
