import { SERVICES_DATA } from '@/data/services'
import { delay } from '@/lib/delay'
import type { ServiceRepository } from '../types'

export const mockServiceRepository: ServiceRepository = {
  async listPublic() {
    await delay()
    return SERVICES_DATA.filter((s) => s.enabled).sort((a, b) => a.order - b.order)
  },
}
