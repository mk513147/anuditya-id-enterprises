import { createSupabaseAdvertisementRepository } from './advertisements'
import { createSupabaseDashboardRepository } from './dashboard'
import { createSupabaseFeedbackRepository } from './feedback'
import { createSupabaseFileRepository } from './files'
import { createSupabaseOrderRepository } from './orders'
import { createSupabaseSchoolRepository } from './schools'
import { createSupabaseServiceRepository } from './services'
import type { Client } from './shared'
import { createSupabaseStudentRepository } from './students'

/**
 * Every Supabase repository for one client. A null client (missing/invalid settings) still yields repositories: each
 * call rejects with RepositoryError('not_configured'), so the UI shows a clear error instead of demo data.
 */
export function createSupabaseRepositories(client: Client | null) {
  return {
    serviceRepository: createSupabaseServiceRepository(client),
    advertisementRepository: createSupabaseAdvertisementRepository(client),
    feedbackRepository: createSupabaseFeedbackRepository(client),
    orderRepository: createSupabaseOrderRepository(client),
    studentRepository: createSupabaseStudentRepository(client),
    fileRepository: createSupabaseFileRepository(client),
    schoolRepository: createSupabaseSchoolRepository(client),
    dashboardRepository: createSupabaseDashboardRepository(client),
  }
}
