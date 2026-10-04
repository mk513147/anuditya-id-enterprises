import type { Advertisement } from '@/types'

/** SAMPLE content for the prototype only. Offers shown here are not real. */
export const ADVERTISEMENTS_DATA: Advertisement[] = [
  {
    id: 'ad-lanyard',
    title: 'Premium ID Card & Lanyard Sets',
    description: 'Get ID cards and printed lanyards together, in your institution colours. Ask for a custom quotation.',
    offer: 'Combo pricing available',
    icon: 'ribbon',
    whatsappMessage: 'Premium ID Card & Lanyard Sets',
    active: true,
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
    featured: false,
  },
  {
    id: 'ad-inactive',
    title: 'Disabled sample advertisement',
    description: 'Inactive ads are never shown publicly.',
    icon: 'banner',
    whatsappMessage: 'Banner Design',
    active: false,
    featured: false,
  },
]
