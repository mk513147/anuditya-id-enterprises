import type { Advertisement } from '@/types'

/**
 * SAMPLE content for the prototype only. Offers shown here are not real.
 *
 * Dates are instants written as India (IST, UTC+5:30) day boundaries: "ends 31 Dec" = 31 Dec 23:59:59 IST = 18:29:59Z,
 * so the label a visitor in India reads matches the date an admin meant.
 *
 * Mixed on purpose so the public visibility rules are exercised: the first four are public today;
 * the rest are hidden (disabled, draft, expired, not yet started).
 */
export const ADVERTISEMENTS_DATA: Advertisement[] = [
  {
    id: 'ad-lanyard',
    title: 'Premium ID Card & Lanyard Sets',
    description: 'Get ID cards and printed lanyards together, in your institution colours. Ask for a custom quotation.',
    offer: 'Combo pricing available',
    icon: 'ribbon',
    whatsappMessage: 'Premium ID Card & Lanyard Sets',
    active: true,
    isPublished: true,
    featured: true,
  },
  {
    id: 'ad-diary',
    title: 'School Diary 2026-27',
    description: 'Custom-designed diaries with your school details and calendar.',
    offer: 'Early booking offer',
    icon: 'diary',
    whatsappMessage: 'School Diary 2026-27',
    active: true,
    isPublished: true,
    endsAt: '2026-12-31T18:29:59.000Z',
    featured: false,
  },
  {
    id: 'ad-magazine',
    title: 'Annual Magazine Design',
    description: 'Creative layouts and quality printing for your school or college magazine.',
    offer: 'Free design consultation',
    icon: 'magazine',
    whatsappMessage: 'Annual Magazine Design',
    active: true,
    isPublished: true,
    endsAt: '2026-11-30T18:29:59.000Z',
    featured: false,
  },
  {
    id: 'ad-prospectus',
    title: 'Admission Prospectus',
    description: 'Present your institution with a polished, easy-to-read prospectus.',
    offer: 'Sample layouts on request',
    icon: 'prospectus',
    whatsappMessage: 'Admission Prospectus',
    active: true,
    isPublished: true,
    startsAt: '2026-08-31T18:30:00.000Z',
    featured: false,
  },
  // --- hidden from the public ---
  {
    id: 'ad-inactive',
    title: 'Disabled sample advertisement',
    description: 'Disabled by an admin, so it is never shown publicly.',
    icon: 'banner',
    whatsappMessage: 'Banner Design',
    active: false,
    isPublished: true,
    featured: false,
  },
  {
    id: 'ad-draft',
    title: 'Draft: festival ID card offer',
    description: 'A draft that has not been published yet.',
    offer: 'Draft offer',
    icon: 'id-card',
    whatsappMessage: 'Festival ID card offer',
    active: true,
    isPublished: false,
    featured: false,
  },
  {
    id: 'ad-expired',
    title: 'Summer admission drive (ended)',
    description: 'This offer ended on 30 June 2026.',
    offer: 'Ended',
    icon: 'school',
    whatsappMessage: 'Summer admission drive',
    active: true,
    isPublished: true,
    startsAt: '2026-03-31T18:30:00.000Z',
    endsAt: '2026-06-30T18:29:59.000Z',
    featured: false,
  },
  {
    id: 'ad-scheduled',
    title: 'Winter diary pre-booking (starts soon)',
    description: 'Scheduled to go live on 1 December 2026.',
    offer: 'Coming soon',
    icon: 'diary',
    whatsappMessage: 'Winter diary pre-booking',
    active: true,
    isPublished: true,
    startsAt: '2026-11-30T18:30:00.000Z',
    featured: false,
  },
]
