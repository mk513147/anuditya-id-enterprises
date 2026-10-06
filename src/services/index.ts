import { mockAdvertisementRepository, mockFeedbackRepository, mockServiceRepository } from './mock'
import { mockDashboardRepository } from './mock/dashboard'
import { mockFileRepository } from './mock/files'
import { mockSchoolRepository } from './mock/schools'
import { mockStudentRepository } from './mock/students'

/** Single place that wires repositories. Swap mock → Supabase here. */
export const serviceRepository = mockServiceRepository
export const advertisementRepository = mockAdvertisementRepository
export const feedbackRepository = mockFeedbackRepository
export const studentRepository = mockStudentRepository
export const fileRepository = mockFileRepository
export const schoolRepository = mockSchoolRepository
export const dashboardRepository = mockDashboardRepository
