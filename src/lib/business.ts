export const BUSINESS = {
  name: 'Anuditya ID Enterprises',
  tagline: 'Your Identity • Our Priority',
  phone: '8541872072',
  whatsapp: '8541872072',
  instagram: 'anudityaid',
  /** India country code, used for wa.me links */
  countryCode: '91',
} as const

export const telHref = `tel:+${BUSINESS.countryCode}${BUSINESS.phone}`
export const instagramHref = `https://instagram.com/${BUSINESS.instagram}`
