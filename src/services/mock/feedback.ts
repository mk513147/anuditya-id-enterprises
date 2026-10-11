import { delay } from '@/lib/delay'
import type { Feedback, FeedbackStatus, ID } from '@/types'
import { RepositoryError } from '../errors'
import type { FeedbackRepository } from '../types'
import { db } from './db'

/**
 * Prototype hook for testing the error and retry states: submit feedback with the name "FAIL".
 * A real repository would reject the same way on a network/database error.
 */
export const MOCK_FEEDBACK_FAILURE_NAME = 'FAIL'

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['pending', 'approved', 'rejected']
const STATUS_RANK: Record<FeedbackStatus, number> = { pending: 0, approved: 1, rejected: 2 }
const isStatus = (v: unknown): v is FeedbackStatus => typeof v === 'string' && (FEEDBACK_STATUSES as string[]).includes(v)

function findById(id: ID): Feedback {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', 'A feedback id is required.')
  const item = db.feedback.find((f) => f.id === id)
  if (!item) throw new RepositoryError('not_found', 'Feedback not found.')
  return item
}

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

  async list({ search = '', status = 'all', rating = 'all', page = 1, pageSize = 10 } = {}) {
    await delay(250)
    if (status !== 'all' && !isStatus(status)) throw new RepositoryError('invalid_filter', 'That moderation status is not supported.')
    if (rating !== 'all' && !([1, 2, 3, 4, 5] as unknown[]).includes(rating)) throw new RepositoryError('invalid_filter', 'The rating must be 1 to 5.')

    const q = search.trim().toLowerCase()
    const matches = db.feedback
      .filter((f) => status === 'all' || f.status === status)
      .filter((f) => rating === 'all' || f.rating === rating)
      .filter((f) => !q || f.name.toLowerCase().includes(q) || f.message.toLowerCase().includes(q))
      // The moderation queue: what needs a decision first, then newest.
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt))

    const total = matches.length
    const size = Math.max(1, pageSize)
    const totalPages = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, page), totalPages)
    const count = (s: FeedbackStatus) => db.feedback.filter((f) => f.status === s).length
    return {
      items: matches.slice((current - 1) * size, current * size).map((f) => ({ ...f })),
      total,
      page: current,
      pageSize: size,
      totalPages,
      counts: { total: db.feedback.length, pending: count('pending'), approved: count('approved'), rejected: count('rejected') },
    }
  },

  async getDetail(id) {
    await delay(250)
    return { ...findById(id) }
  },

  async setStatus(id, status) {
    await delay(400)
    const item = findById(id)
    if (!isStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported moderation status.')
    if (item.status === status) throw new RepositoryError('no_change', `This feedback is already ${status}.`)
    // The one shared record: the public list and Home read it, so the change shows there straight away.
    item.status = status
    return { ...item }
  },
}
