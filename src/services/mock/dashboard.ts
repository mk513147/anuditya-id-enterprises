import { delay } from '@/lib/delay'
import type { DashboardRepository } from '../types'
import { db } from './db'

/** Every figure is derived from the same mock tables the rest of the app reads and writes. */
export const mockDashboardRepository: DashboardRepository = {
  async get() {
    await delay(350)
    const { schools, students, orders, files } = db
    return {
      counts: {
        totalSchools: schools.length,
        activeSchools: schools.filter((s) => s.isActive).length,
        totalStudents: students.filter((s) => !s.isArchived).length, // active records only
        pendingOrders: orders.filter((o) => o.status === 'Order Received' || o.status === 'Data Verification').length,
        uploadedFiles: files.length,
        awaitingCompletion: orders.filter((o) => o.status !== 'Delivered').length,
      },
      recentOrders: [...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)).slice(0, 5).map((o) => ({ ...o })),
      recentSchools: [...schools]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4)
        .map((s) => ({ ...s, studentCount: students.filter((st) => st.schoolId === s.id && !st.isArchived).length })),
    }
  },
}
