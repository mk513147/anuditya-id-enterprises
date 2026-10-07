import { mockServiceRepository } from './mock'
import { mockAdvertisementRepository } from './mock/advertisements'
import { mockDashboardRepository } from './mock/dashboard'
import { mockFeedbackRepository } from './mock/feedback'
import { mockFileRepository } from './mock/files'
import { mockOrderRepository } from './mock/orders'
import { mockSchoolRepository } from './mock/schools'
import { mockStudentRepository } from './mock/students'

/** Single place that wires repositories. Swap mock → Supabase here. */
export const serviceRepository = mockServiceRepository
export const advertisementRepository = mockAdvertisementRepository
export const feedbackRepository = mockFeedbackRepository
export const orderRepository = mockOrderRepository
export const studentRepository = mockStudentRepository
export const fileRepository = mockFileRepository
export const schoolRepository = mockSchoolRepository
export const dashboardRepository = mockDashboardRepository
