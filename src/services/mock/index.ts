import { ADVERTISEMENTS_DATA } from '@/data/advertisements'
import { FEEDBACK_DATA } from '@/data/feedback'
import { SERVICES_DATA } from '@/data/services'
import { delay } from '@/lib/delay'
import type { AdvertisementRepository, FeedbackRepository, ServiceRepository } from '../types'

export const mockServiceRepository: ServiceRepository = {
  async listPublic() {
    await delay()
    return SERVICES_DATA.filter((s) => s.enabled).sort((a, b) => a.order - b.order)
  },
}

export const mockAdvertisementRepository: AdvertisementRepository = {
  async listPublic() {
    await delay()
    return ADVERTISEMENTS_DATA.filter((a) => a.active)
  },
}

export const mockFeedbackRepository: FeedbackRepository = {
  async listApproved() {
    await delay()
    return FEEDBACK_DATA.filter((f) => f.status === 'approved')
  },
}
