import type { Tone } from '@/data/homeContent'

/** Soft icon-chip styles and solid card styles per accent tone. */
export const TONE_CHIP: Record<Tone, string> = {
  blue: 'bg-royal-100 text-royal-600',
  green: 'bg-emerald-100 text-emerald-700',
  purple: 'bg-violet-100 text-violet-700',
  orange: 'bg-orange-100 text-orange-600',
  gold: 'bg-gold-100 text-gold-700',
  pink: 'bg-pink-100 text-pink-600',
}

export const TONE_SOLID: Record<Tone, string> = {
  blue: 'from-royal-600 to-royal-700',
  green: 'from-emerald-500 to-emerald-700',
  purple: 'from-violet-500 to-violet-700',
  orange: 'from-orange-400 to-orange-600',
  gold: 'from-gold-400 to-gold-600',
  pink: 'from-pink-500 to-pink-700',
}
