import { delay } from '@/lib/delay'
import type { Feedback } from '@/types'
import type { FeedbackRepository } from '../types'
import { db } from './db'

/**
 * Prototype hook for testing the error and retry states: submit feedback with the name "FAIL".
 * A real repository would reject the same way on a network/database error.
 */
export const MOCK_FEEDBACK_FAILURE_NAME = 'FAIL'

export const mockFeedbackRepository: FeedbackRepository = {
  async listApproved() {
    await delay()
    return db.feedback
      .filter((f) => f.status === 'approved') // pending and rejected are never public
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => ({ ...f }))
  },

  async submit(input) {
    await delay(900)
    const name = input.name.trim()
    if (name.toUpperCase() === MOCK_FEEDBACK_FAILURE_NAME) throw new Error('Mock feedback failure')

    // The data layer re-checks the essentials; the form is never the only gatekeeper.
    const message = input.message.trim()
    if (!name || !message || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new Error('Invalid feedback')
    }

    const feedback: Feedback = {
      id: crypto.randomUUID(),
      name,
      organization: input.organization?.trim() || undefined,
      rating: input.rating,
      message,
      status: 'pending', // always: an admin must approve before it is public
      createdAt: new Date().toISOString(),
    }
    db.feedback.push(feedback)
    return { id: feedback.id, status: 'pending' }
  },
}
