import { delay } from '@/lib/delay'
import { isAdvertisementVisible } from '@/lib/advertisements'
import type { AdvertisementRepository } from '../types'
import { db } from './db'

/** Single source for the Home page section and /advertisement. Hidden ads never leave this function. */
export const mockAdvertisementRepository: AdvertisementRepository = {
  async listPublic(now = new Date()) {
    await delay()
    return db.advertisements.filter((a) => isAdvertisementVisible(a, now)).map((a) => ({ ...a }))
  },
}
