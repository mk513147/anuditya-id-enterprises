import { supabase, supabaseConfigProblem } from '@/lib/supabase'
import { mockServiceRepository } from './mock'
import { mockAdvertisementRepository } from './mock/advertisements'
import { mockDashboardRepository } from './mock/dashboard'
import { mockFeedbackRepository } from './mock/feedback'
import { mockFileRepository } from './mock/files'
import { mockOrderRepository } from './mock/orders'
import { mockSchoolRepository } from './mock/schools'
import { mockStudentRepository } from './mock/students'
import { resolveDataSource } from './runtime'
import { createSupabaseRepositories } from './supabase'

/**
 * Single place that wires repositories. The data source is decided once, at start-up (see runtime.ts):
 * 'supabase' uses the live database; 'mock' uses the in-memory demo data and is labelled as such in the UI.
 * In 'supabase' mode a configuration problem is reported, never papered over with demo data.
 */
export const dataSource = resolveDataSource({
  requested: import.meta.env.VITE_DATA_SOURCE,
  production: import.meta.env.PROD,
  configured: supabase !== null,
})

/** Set only when the live data source is selected but its settings are missing or invalid. */
export const dataSourceProblem = dataSource === 'supabase' ? supabaseConfigProblem : null

const live = dataSource === 'supabase' ? createSupabaseRepositories(supabase) : null

export const serviceRepository = live?.serviceRepository ?? mockServiceRepository
export const advertisementRepository = live?.advertisementRepository ?? mockAdvertisementRepository
export const feedbackRepository = live?.feedbackRepository ?? mockFeedbackRepository
export const orderRepository = live?.orderRepository ?? mockOrderRepository
export const studentRepository = live?.studentRepository ?? mockStudentRepository
export const fileRepository = live?.fileRepository ?? mockFileRepository
export const schoolRepository = live?.schoolRepository ?? mockSchoolRepository
export const dashboardRepository = live?.dashboardRepository ?? mockDashboardRepository
