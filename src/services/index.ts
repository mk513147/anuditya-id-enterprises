import { mockAdvertisementRepository, mockFeedbackRepository, mockServiceRepository } from './mock'
import { mockFileRepository } from './mock/files'
import { mockStudentRepository } from './mock/students'

/** Single place that wires repositories. Swap mock → Supabase here. */
export const serviceRepository = mockServiceRepository
export const advertisementRepository = mockAdvertisementRepository
export const feedbackRepository = mockFeedbackRepository
export const studentRepository = mockStudentRepository
export const fileRepository = mockFileRepository
