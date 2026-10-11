import type { FileReviewStatus, OrderStatus, ServiceCategory, UploadedFileType } from '@/types'
import { requireClient, unwrap, guarded, type Client } from './shared'

/** Shape of public.admin_summary() (migrations 20261012090001 and 20261013090001): counts only, administrator only. */
export interface AdminSummary {
  schools: { total: number; active: number }
  students: { total: number; notArchived: number; archived: number; pending: number; approved: number; rejected: number }
  studentSections: string[]
  orders: { total: number; byStatus: Record<OrderStatus, number> }
  files: { total: number; totalBytes: number; stored: number; byType: Record<UploadedFileType, number>; pendingReview: number; byReview: Record<FileReviewStatus, number> }
  /** Objects in the public upload folders, older than an hour, that no record uses (cleanup needed; see the docs). */
  storage: { unregisteredUploads: number }
  services: { total: number; enabled: number; disabled: number; byCategory: Record<ServiceCategory, number> }
  advertisements: { total: number; live: number; scheduled: number; ended: number; hidden: number; drafts: number; disabled: number }
  feedback: { total: number; pending: number; approved: number; rejected: number }
  recentSchools: { id: string; name: string; code: string; is_active: boolean; created_at: string; student_count: number }[]
}

export async function fetchSummary(client: Client | null): Promise<AdminSummary> {
  const c = requireClient(client)
  return unwrap(await guarded(() => Promise.resolve(c.rpc('admin_summary'))))
}
