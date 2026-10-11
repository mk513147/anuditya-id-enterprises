import type { FeedbackStatus } from '@/types'
import { RepositoryError } from '../errors'
import type { FeedbackRepository } from '../types'
import { FEEDBACK_COLUMNS, toFeedback, type FeedbackRow } from './rows'
import { fetchSummary } from './summary'
import { fetchPage, guarded, ilikeAny, requireClient, requireId, searchTerm, unwrap, type Client } from './shared'

const STATUSES: FeedbackStatus[] = ['pending', 'approved', 'rejected']
const isStatus = (v: unknown): v is FeedbackStatus => typeof v === 'string' && (STATUSES as string[]).includes(v)

export function createSupabaseFeedbackRepository(client: Client | null): FeedbackRepository {
  async function one(c: Client, id: string) {
    const row = unwrap(await guarded(() => Promise.resolve(c.from('feedback').select(FEEDBACK_COLUMNS).eq('id', id).maybeSingle()))) as FeedbackRow | null
    if (!row) throw new RepositoryError('not_found', 'Feedback not found.')
    return toFeedback(row)
  }

  return {
    async listApproved() {
      const c = requireClient(client)
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('list_approved_feedback', { p_limit: 100 })))) as FeedbackRow[]
      return rows.map(toFeedback)
    },

    async submit(input) {
      const c = requireClient(client)
      const name = input.name.trim()
      const message = input.message.trim()
      if (!name || !message || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new RepositoryError('invalid_input', 'Please check your name, rating and message.')
      }
      // Stored as pending by the database itself; nothing the browser sends can publish it.
      const rows = unwrap(
        await guarded(() =>
          Promise.resolve(c.rpc('submit_feedback', { p_name: name, p_organization: input.organization?.trim() || null, p_rating: input.rating, p_message: message })),
        ),
      ) as { id: string; status: string }[]
      if (!rows[0]) throw new RepositoryError('unknown', 'Your feedback could not be confirmed. Please try again.')
      return { id: rows[0].id, status: 'pending' }
    },

    async list({ search, status = 'all', rating = 'all', page, pageSize } = {}) {
      if (status !== 'all' && !isStatus(status)) throw new RepositoryError('invalid_filter', 'That moderation status is not supported.')
      if (rating !== 'all' && !([1, 2, 3, 4, 5] as unknown[]).includes(rating)) throw new RepositoryError('invalid_filter', 'The rating must be 1 to 5.')
      const c = requireClient(client)
      const query = () => {
        let q = c.from('feedback').select(FEEDBACK_COLUMNS, { count: 'exact' })
        if (status !== 'all') q = q.eq('status', status)
        if (rating !== 'all') q = q.eq('rating', rating)
        const term = searchTerm(search)
        if (term) q = q.or(ilikeAny(['name', 'message'], term))
        // The moderation queue: what needs a decision first (enum order pending, approved, rejected), then newest.
        return q.order('status').order('created_at', { ascending: false }).order('id')
      }
      const [result, summary] = await Promise.all([fetchPage<FeedbackRow>((f, t) => query().range(f, t), page, pageSize), fetchSummary(c)])
      return { ...result, items: result.items.map(toFeedback), counts: summary.feedback }
    },

    async getDetail(id) {
      return one(requireClient(client), requireId(id, 'feedback'))
    },

    async setStatus(id, status) {
      const c = requireClient(client)
      const feedbackId = requireId(id, 'feedback')
      if (!isStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported moderation status.')
      if ((await one(c, feedbackId)).status === status) throw new RepositoryError('no_change', `This feedback is already ${status}.`)
      const row = unwrap(await guarded(() => Promise.resolve(c.from('feedback').update({ status }).eq('id', feedbackId).select(FEEDBACK_COLUMNS).maybeSingle()))) as FeedbackRow | null
      if (!row) throw new RepositoryError('not_found', 'Feedback not found.')
      return toFeedback(row)
    },
  }
}
