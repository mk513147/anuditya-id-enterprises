import type { DashboardRepository } from '../types'
import { ORDER_COLUMNS, toOrder, type OrderRow } from './rows'
import { fetchSummary } from './summary'
import { guarded, requireClient, unwrap, type Client } from './shared'

/** Each widget reads independently, so one failure does not blank the whole dashboard. */
export function createSupabaseDashboardRepository(client: Client | null): DashboardRepository {
  return {
    async getCounts() {
      const s = await fetchSummary(client)
      const by = s.orders.byStatus
      return {
        totalSchools: s.schools.total,
        activeSchools: s.schools.active,
        totalStudents: s.students.notArchived,
        pendingStudentReviews: s.students.pending,
        pendingOrders: (by['Order Received'] ?? 0) + (by['Data Verification'] ?? 0),
        uploadedFiles: s.files.total,
        pendingFileReviews: s.files.pendingReview ?? 0,
        awaitingCompletion: s.orders.total - (by.Delivered ?? 0),
        pendingFeedback: s.feedback.pending,
      }
    },

    async getRecentOrders() {
      const c = requireClient(client)
      const rows = unwrap(
        await guarded(() => Promise.resolve(c.from('orders').select(ORDER_COLUMNS).order('order_date', { ascending: false }).order('order_no', { ascending: false }).limit(5))),
      ) as OrderRow[]
      return rows.map(toOrder)
    },

    async getRecentSchools() {
      const s = await fetchSummary(client)
      return s.recentSchools.map((r) => ({ id: r.id, name: r.name, code: r.code, isActive: r.is_active, createdAt: r.created_at, studentCount: Number(r.student_count) }))
    },
  }
}
