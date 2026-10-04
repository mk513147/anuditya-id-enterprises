import type { Feedback } from '@/types'

/** SAMPLE feedback for the prototype. Only `approved` items are shown publicly. */
export const FEEDBACK_DATA: Feedback[] = [
  { id: 'fb-1', name: 'Rajesh Kumar', organization: "St. Mary's School", rating: 5, message: 'Very good quality ID cards and timely delivery. The design and printing were excellent.', status: 'approved', createdAt: '2026-08-12' },
  { id: 'fb-2', name: 'Pooja Singh', organization: 'Green Valley College', rating: 5, message: 'Excellent service and support. Highly recommended for college ID cards and diaries.', status: 'approved', createdAt: '2026-08-08' },
  { id: 'fb-3', name: 'Amit Verma', organization: 'Sunrise Public School', rating: 4, message: 'Best ID card and printing solution in the region. They handled our data sheet without any trouble.', status: 'approved', createdAt: '2026-08-05' },
  { id: 'fb-4', name: 'Neha Kumari', organization: 'Model Academy', rating: 4, message: 'Waiting for approval.', status: 'pending', createdAt: '2026-09-01' },
  { id: 'fb-5', name: 'Anonymous', organization: 'Unknown', rating: 1, message: 'Rejected sample entry.', status: 'rejected', createdAt: '2026-09-02' },
]
